<?php

namespace App\Services\References;

use App\Models\Company;
use App\Models\Reference;
use App\Models\ReferenceLot;
use App\Models\ReferenceOperation;
use App\Models\User;
use App\Support\OperationDifficulty;
use App\Support\ReferenceLotCompletion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reprograma una referencia: cierra la programacion vigente y abre la siguiente con su
 * propio lote, valor por unidad y precios de operacion.
 *
 * Es lo que se hace cuando el cliente vuelve a pedir la misma prenda: antes habia que
 * duplicar la referencia (otro codigo, otro historial) o inflar el lote sumando el pedido
 * nuevo al anterior. Aqui la referencia es la misma y lo producido antes se conserva:
 *
 * - La programacion que termina queda en `reference_lots` tal como estaba.
 * - Los registros de produccion ya hechos no se tocan: siguen con su programacion y con el
 *   precio con el que se registraron, asi que la nomina los liquida igual.
 * - El tope del lote vuelve a contar desde cero (ver ReferenceLotTotals).
 * - La referencia y todas sus lineas quedan activas, aunque el lote anterior las hubiera
 *   cerrado: una programacion nueva es para producirse.
 */
class ReferenceReprogrammer
{
    /**
     * @param  array{lot_total_quantity: int|string, payment_per_unit: float|string, operations?: list<array{operation_id: int|string, price: float|string}>}  $data
     */
    public function reprogram(Reference $reference, array $data, ?User $user = null): ReferenceLot
    {
        $closed = DB::transaction(function () use ($reference, $data, $user) {
            // Bloqueo: dos reprogramaciones simultaneas abririan la misma programacion.
            $locked = Reference::query()->withoutGlobalScopes()->lockForUpdate()->findOrFail($reference->id);
            $lines = $locked->referenceOperations()
                ->with(['operation' => fn ($q) => $q->withoutGlobalScopes()])
                ->get();

            $closed = ReferenceLot::create([
                'reference_id' => $locked->id,
                'lot_number' => $locked->currentLotNumber(),
                'lot_total_quantity' => $locked->lot_total_quantity,
                'payment_per_unit' => $locked->getAttributes()['payment_per_unit'] ?? null,
                'operational_cost_per_unit' => $locked->productionCostPerUnit(),
                'operations' => $lines->map(fn (ReferenceOperation $line) => [
                    'operation_id' => (int) $line->operation_id,
                    'name' => $line->operation?->name,
                    'price' => (float) $line->price,
                    'estimated_minutes' => $line->estimated_minutes !== null ? (float) $line->estimated_minutes : null,
                    'difficulty_level' => $line->difficulty_level,
                ])->values()->all(),
                'started_at' => $locked->lot_started_at ?? $locked->created_at,
                'ended_at' => now(),
                'closed_by' => $user?->id,
            ]);

            $this->syncOperations($locked, $lines, $data['operations'] ?? null);

            $locked->update([
                'lot_number' => $locked->currentLotNumber() + 1,
                'lot_started_at' => now(),
                'lot_total_quantity' => (int) $data['lot_total_quantity'],
                'payment_per_unit' => round((float) $data['payment_per_unit'], 2),
                'is_active' => true,
            ]);

            $locked->refreshOperationalCost();

            return $closed;
        });

        // Por si la programacion nueva ya nace cubierta (no deberia: arranca en cero).
        ReferenceLotCompletion::sync((int) $reference->id);

        $reference->refresh();

        return $closed;
    }

    /**
     * Deja el detalle de operaciones como lo pide la programacion nueva.
     *
     * `$rows` es la lista completa: la linea que no venga se quita (esta programacion no la
     * lleva), la que no existia se agrega y la que sigue toma su precio nuevo. Sin lista
     * (`null`) el detalle se conserva tal cual, solo reactivado.
     *
     * Quitar una linea no borra historia: lo que se produjo con ella sigue en `productions`
     * con su operacion y su precio, y la linea queda en la foto de la programacion cerrada.
     *
     * @param  Collection<int, ReferenceOperation>  $lines
     * @param  list<array{operation_id: int|string, price: float|string, estimated_minutes?: float|string|null}>|null  $rows
     */
    protected function syncOperations(Reference $reference, Collection $lines, ?array $rows): void
    {
        if ($rows === null) {
            ReferenceOperation::query()->where('reference_id', $reference->id)->update(['is_active' => true]);

            return;
        }

        $wanted = collect($rows)->keyBy(fn ($row) => (int) $row['operation_id']);
        $thresholds = OperationDifficulty::thresholdsFor(Company::query()->find($reference->company_id));

        foreach ($lines as $line) {
            $row = $wanted->get((int) $line->operation_id);

            if ($row === null) {
                $line->delete();

                continue;
            }

            $attributes = ['price' => round((float) $row['price'], 2), 'is_active' => true];

            // Los minutos solo cambian si vienen: la pantalla de reprogramar los muestra,
            // pero otro consumidor puede mandar solo precios.
            if (array_key_exists('estimated_minutes', $row)) {
                $attributes += $this->minutesAndDifficulty($row['estimated_minutes'], $thresholds);
            }

            $line->forceFill($attributes)->save();
        }

        $existing = $lines->pluck('operation_id')->map(fn ($id) => (int) $id)->all();

        foreach ($wanted as $operationId => $row) {
            if (in_array($operationId, $existing, true)) {
                continue;
            }

            ReferenceOperation::create(array_merge([
                'reference_id' => $reference->id,
                'operation_id' => $operationId,
                'price' => round((float) $row['price'], 2),
                'is_active' => true,
            ], $this->minutesAndDifficulty($row['estimated_minutes'] ?? null, $thresholds)));
        }
    }

    /**
     * Minutos de la linea y su grado, con la misma regla que al crear la referencia: sin
     * minutos la linea hereda los del dato maestro de la operacion.
     *
     * @param  list<int|float>  $thresholds
     * @return array{estimated_minutes: float|null, difficulty_level: int|null}
     */
    protected function minutesAndDifficulty(mixed $minutes, array $thresholds): array
    {
        if ($minutes === null || $minutes === '') {
            return ['estimated_minutes' => null, 'difficulty_level' => null];
        }

        return [
            'estimated_minutes' => round((float) $minutes, 2),
            'difficulty_level' => OperationDifficulty::levelFromMinutes((float) $minutes, $thresholds),
        ];
    }
}
