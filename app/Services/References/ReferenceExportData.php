<?php

namespace App\Services\References;

use App\Models\Production;
use App\Models\Reference;
use App\Support\OperationDifficulty;
use Illuminate\Support\Collection;

/**
 * Arma el retrato completo de una o varias referencias para exportarlas.
 *
 * Es la unica fuente de la exportacion: el Excel y la vista de impresion (PDF) leen de
 * aqui, para que las dos salidas digan exactamente lo mismo —incluido el costo
 * operacional y todo lo que se deriva de el— sin repetir el calculo en cada formato.
 *
 * Las cifras nacen del detalle de operaciones ya guardado, igual que la ficha en
 * pantalla: el costo unitario es la suma de los precios de las lineas (activas o no,
 * ver Reference::refreshOperationalCost) y el avance se mide contra la operacion mas
 * adelantada, nunca contra la suma de todas.
 */
class ReferenceExportData
{
    /**
     * @param  Collection<int, Reference>  $references
     * @return array{
     *     company: array{name: string, nit: string|null, address: string|null, phone: string|null, logo: string|null},
     *     currency: string,
     *     generated_at: string,
     *     totals: array<string, float|int>,
     *     references: list<array<string, mixed>>
     * }
     */
    public function build(Collection $references): array
    {
        $references->loadMissing(['operations', 'company']);

        $producedByOperation = $this->producedByOperation($references->pluck('id')->all());

        $rows = $references
            ->map(fn (Reference $reference) => $this->reference($reference, $producedByOperation[$reference->id] ?? []))
            ->values()
            ->all();

        $company = $references->first()?->company;
        $settings = $company?->settings ?? [];

        return [
            'company' => [
                'name' => $company?->name ?? 'Empresa',
                'nit' => $company?->nit,
                'address' => $company?->address,
                'phone' => $company?->phone,
                // El logo se usa en el encabezado del PDF; toArray resuelve la URL publica.
                'logo' => $company?->toArray()['logo'] ?? null,
            ],
            'currency' => is_array($settings) ? (string) ($settings['currency'] ?? 'COP') : 'COP',
            'generated_at' => now()->format('d/m/Y H:i'),
            'totals' => $this->totals($rows),
            'references' => $rows,
        ];
    }

    /**
     * @param  array<int, int>  $produced  unidades acumuladas por operation_id
     * @return array<string, mixed>
     */
    protected function reference(Reference $reference, array $produced): array
    {
        $lot = (int) ($reference->lot_total_quantity ?? 0);
        $paymentDefined = ($reference->getAttributes()['payment_per_unit'] ?? null) !== null;
        $payment = (float) ($reference->payment_per_unit ?? 0);
        $cost = $reference->productionCostPerUnit();
        $margin = round($payment - $cost, 2);

        $lines = $reference->operations
            ->map(fn ($operation) => $this->line($operation, $cost, $lot, $produced))
            ->values()
            ->all();

        // La operacion mas adelantada es la que marca el avance del lote: la suma de todas
        // daria varios lotes por prenda (una unidad pasa por cada operacion).
        $producedMax = $produced === [] ? 0 : (int) max($produced);
        $producedTotal = array_sum($produced);

        return [
            'id' => (int) $reference->id,
            'code' => (string) $reference->code,
            'name' => (string) $reference->name,
            'description' => $reference->description,
            'is_active' => (bool) $reference->is_active,
            'status_label' => $reference->is_active ? 'Activa' : 'Inactiva',
            'image_url' => $reference->toArray()['image'] ?? null,
            'created_at' => $reference->created_at?->format('d/m/Y'),
            'updated_at' => $reference->updated_at?->format('d/m/Y'),

            'lot_total_quantity' => $lot,
            'payment_per_unit' => $payment,
            'payment_defined' => $paymentDefined,
            'operational_cost_per_unit' => $cost,
            'margin_per_unit' => $margin,
            'margin_ratio' => $payment > 0 ? round($margin / $payment, 4) : null,

            'lot_payment_total' => round($payment * $lot, 2),
            'lot_operational_total' => round($cost * $lot, 2),
            'lot_margin_total' => round($margin * $lot, 2),

            'operations_count' => count($lines),
            'operations_active_count' => count(array_filter($lines, fn ($l) => $l['is_active'])),
            // Una linea esta completa cuando su produccion acumulada cubre el lote.
            'operations_completed_count' => $lot > 0
                ? count(array_filter($lines, fn ($l) => $l['produced'] >= $lot))
                : 0,
            'total_minutes' => round(array_sum(array_column($lines, 'minutes')), 2),

            'produced_max_per_operation' => $producedMax,
            'produced_total' => (int) $producedTotal,
            'pending_units' => $lot > 0 ? max(0, $lot - $producedMax) : null,
            'progress_ratio' => $lot > 0 ? round(min(1, $producedMax / $lot), 4) : null,

            'operations' => $lines,
        ];
    }

    /**
     * @param  array<int, int>  $produced
     * @return array<string, mixed>
     */
    protected function line(mixed $operation, float $cost, int $lot, array $produced): array
    {
        $pivot = $operation->pivot;
        $ownMinutes = $pivot->estimated_minutes;
        $inherited = $ownMinutes === null || $ownMinutes === '';
        $minutes = (float) ($inherited ? ($operation->estimated_minutes ?? 0) : $ownMinutes);
        $level = $pivot->difficulty_level ?? $operation->difficulty_level;
        $price = (float) $pivot->price;
        $done = (int) ($produced[$operation->id] ?? 0);

        return [
            'operation_id' => (int) $operation->id,
            'name' => (string) $operation->name,
            'description' => $operation->description,
            'price' => $price,
            'minutes' => $minutes,
            // Sin minutos propios la linea hereda los del dato maestro de la operacion.
            'minutes_inherited' => $inherited,
            'difficulty_level' => $level !== null ? (int) $level : null,
            'difficulty_label' => OperationDifficulty::label($level !== null ? (int) $level : null),
            'is_active' => (bool) $pivot->is_active,
            'status_label' => $pivot->is_active ? 'Activa' : 'Cerrada',
            'cost_share' => $cost > 0 ? round($price / $cost, 4) : null,
            'lot_total' => round($price * $lot, 2),
            'produced' => $done,
            'pending' => $lot > 0 ? max(0, $lot - $done) : null,
        ];
    }

    /**
     * Produccion acumulada por referencia y operacion.
     *
     * Sin scopes: la produccion de una referencia de la empresa activa puede haberse
     * registrado con otro company_id historico, y aun asi es produccion suya.
     *
     * @param  list<int>  $referenceIds
     * @return array<int, array<int, int>>
     */
    protected function producedByOperation(array $referenceIds): array
    {
        if ($referenceIds === []) {
            return [];
        }

        return Production::query()
            ->withoutGlobalScopes()
            ->selectRaw('reference_id, operation_id, SUM(quantity) as op_sum')
            ->whereIn('reference_id', $referenceIds)
            ->groupBy('reference_id', 'operation_id')
            ->get()
            ->groupBy('reference_id')
            ->map(fn ($rows) => $rows->pluck('op_sum', 'operation_id')->map(fn ($v) => (int) $v)->all())
            ->all();
    }

    /**
     * Consolidado de la seleccion, para la hoja resumen y el pie del PDF.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, float|int>
     */
    protected function totals(array $rows): array
    {
        return [
            'references' => count($rows),
            'active' => count(array_filter($rows, fn ($r) => $r['is_active'])),
            'inactive' => count(array_filter($rows, fn ($r) => ! $r['is_active'])),
            'operations' => (int) array_sum(array_column($rows, 'operations_count')),
            'lot_units' => (int) array_sum(array_column($rows, 'lot_total_quantity')),
            'lot_payment_total' => round((float) array_sum(array_column($rows, 'lot_payment_total')), 2),
            'lot_operational_total' => round((float) array_sum(array_column($rows, 'lot_operational_total')), 2),
            'lot_margin_total' => round((float) array_sum(array_column($rows, 'lot_margin_total')), 2),
        ];
    }
}
