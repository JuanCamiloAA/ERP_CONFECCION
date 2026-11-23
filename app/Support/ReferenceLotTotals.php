<?php

namespace App\Support;

use App\Models\Production;
use App\Models\Reference;
use App\Models\ReferenceLot;
use App\Models\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Lo producido de cada referencia, medido por programacion.
 *
 * Es el unico sitio que suma produccion contra el lote: el tope al registrar, el cierre
 * automatico, el avance del listado y de la ficha y la exportacion leen de aqui. Si cada
 * uno sumara a su manera, reprogramar dejaria pantallas contando el lote nuevo y otras
 * arrastrando el anterior.
 *
 * Reglas:
 * - Cuenta solo la programacion pedida (por defecto, la vigente de la referencia).
 * - Sin el scope de empresa: la produccion de una referencia puede haberse registrado con
 *   otro company_id historico y sigue siendo suya.
 * - CON el de borrado: un registro eliminado ya no ocupa lugar en el lote. Antes se quitaban
 *   todos los scopes y un registro borrado seguia descontando unidades para siempre.
 */
final class ReferenceLotTotals
{
    /** Produccion viva (sin eliminadas), sin filtrar por empresa. */
    public static function query(): Builder
    {
        return Production::query()->withoutGlobalScope(CompanyScope::class);
    }

    /**
     * Unidades por operacion de una programacion de la referencia.
     *
     * @return array<int, int> operation_id => unidades
     */
    public static function byOperation(int $referenceId, int $lotNumber, ?int $excludeProductionId = null): array
    {
        return self::query()
            ->where('reference_id', $referenceId)
            ->where('lot_number', $lotNumber)
            ->when($excludeProductionId, fn ($q) => $q->where('id', '!=', $excludeProductionId))
            ->selectRaw('operation_id, SUM(quantity) as qty')
            ->groupBy('operation_id')
            ->pluck('qty', 'operation_id')
            ->map(fn ($qty) => (int) $qty)
            ->all();
    }

    /**
     * Unidades por operacion de la programacion VIGENTE de varias referencias, en una sola
     * consulta.
     *
     * @param  iterable<int>  $referenceIds
     * @return array<int, array<int, int>> reference_id => [operation_id => unidades]
     */
    public static function currentByOperation(iterable $referenceIds): array
    {
        $ids = collect($referenceIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $rows = self::query()
            ->whereIn('reference_id', $ids)
            ->whereExists(function (QueryBuilder $sub) {
                $sub->selectRaw('1')
                    ->from('references')
                    ->whereColumn('references.id', 'productions.reference_id')
                    ->whereColumn('references.lot_number', 'productions.lot_number');
            })
            ->selectRaw('reference_id, operation_id, SUM(quantity) as qty')
            ->groupBy('reference_id', 'operation_id')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row->reference_id][(int) $row->operation_id] = (int) $row->qty;
        }

        return $map;
    }

    /**
     * Avance de la programacion vigente con las dos cifras que se miden contra el lote.
     *
     * - `max`: unidades de la operacion mas avanzada. Es lo comparable contra el lote; la
     *   suma de todas las operaciones daria un 800% en una prenda de ocho pasos.
     * - `completed`: cuantas operaciones ya cubren el lote completo.
     *
     * @param  array<int, int>  $byOperation
     * @return array{max: int, completed: int}
     */
    public static function progress(array $byOperation, ?int $lot): array
    {
        $lot = (int) ($lot ?? 0);

        return [
            'max' => $byOperation === [] ? 0 : (int) max($byOperation),
            // Sin lote definido no hay meta contra la cual dar una operacion por completa.
            'completed' => $lot > 0 ? count(array_filter($byOperation, fn ($sum) => (int) $sum >= $lot)) : 0,
        ];
    }

    /** ¿La programacion vigente ya tiene algo registrado? */
    public static function currentHasProduction(Reference $reference): bool
    {
        return self::query()
            ->where('reference_id', $reference->id)
            ->where('lot_number', $reference->currentLotNumber())
            ->exists();
    }

    /**
     * Historial de programaciones de la referencia, de la vigente a la primera.
     *
     * Las cerradas salen de su foto en `reference_lots`; la vigente, de la propia
     * referencia. La produccion de cada una se suma aqui mismo, en una sola consulta.
     *
     * @return list<array<string, mixed>>
     */
    public static function history(Reference $reference): array
    {
        // Consultas aparte, sin cargar relaciones en el modelo: la referencia suele viajar
        // tambien como prop de la pagina y no tiene por que arrastrar el historial.
        $closedLots = $reference->lots()->with('closedBy:id,name,last_name')->get();
        $currentOperations = $reference->referenceOperations()->count();

        $stats = self::query()
            ->where('reference_id', $reference->id)
            ->selectRaw('lot_number, operation_id, SUM(quantity) as qty, SUM(total_value) as value, COUNT(*) as records')
            ->groupBy('lot_number', 'operation_id')
            ->get()
            ->groupBy('lot_number');

        $summary = function (int $lotNumber, ?int $lot, int $operationsTotal) use ($stats): array {
            $rows = $stats->get($lotNumber) ?? collect();
            $byOperation = $rows->mapWithKeys(fn ($r) => [(int) $r->operation_id => (int) $r->qty])->all();
            $progress = self::progress($byOperation, $lot);

            return [
                'produced_max' => $progress['max'],
                'operations_completed' => $progress['completed'],
                'operations_total' => $operationsTotal,
                'records' => (int) $rows->sum('records'),
                'production_value' => round((float) $rows->sum('value'), 2),
            ];
        };

        $current = $reference->currentLotNumber();
        $payment = $reference->getAttributes()['payment_per_unit'] ?? null;

        $items = [array_merge([
            'lot_number' => $current,
            'is_current' => true,
            'lot_total_quantity' => $reference->lot_total_quantity !== null ? (int) $reference->lot_total_quantity : null,
            'payment_per_unit' => $payment !== null ? (float) $payment : null,
            'operational_cost_per_unit' => $reference->productionCostPerUnit(),
            'started_at' => ($reference->lot_started_at ?? $reference->created_at)?->toIso8601String(),
            'ended_at' => null,
            'closed_by' => null,
        ], $summary($current, $reference->lot_total_quantity, $currentOperations))];

        foreach ($closedLots as $closed) {
            /** @var ReferenceLot $closed */
            $operations = is_array($closed->operations) ? $closed->operations : [];

            $items[] = array_merge([
                'lot_number' => (int) $closed->lot_number,
                'is_current' => false,
                'lot_total_quantity' => $closed->lot_total_quantity,
                'payment_per_unit' => $closed->payment_per_unit !== null ? (float) $closed->payment_per_unit : null,
                'operational_cost_per_unit' => (float) $closed->operational_cost_per_unit,
                'started_at' => $closed->started_at?->toIso8601String(),
                'ended_at' => $closed->ended_at?->toIso8601String(),
                'closed_by' => $closed->closedBy?->full_name ?: null,
            ], $summary((int) $closed->lot_number, $closed->lot_total_quantity, count($operations)));
        }

        return $items;
    }
}
