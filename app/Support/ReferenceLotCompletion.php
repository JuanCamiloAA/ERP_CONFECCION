<?php

namespace App\Support;

use App\Models\Production;
use App\Models\Reference;
use App\Models\ReferenceOperation;

/**
 * Cuando, para cada operacion asociada a la referencia, la suma de produccion alcanza el tope del lote,
 * inactiva la referencia y todas sus operaciones en el pivote, de modo que dejan de aparecer
 * en los selectores de produccion (Reference::active() + pivot is_active).
 */
final class ReferenceLotCompletion
{
    public static function sync(int $referenceId): void
    {
        if ($referenceId < 1) {
            return;
        }

        $reference = Reference::query()->withoutGlobalScopes()->find($referenceId);
        if (! $reference || $reference->lot_total_quantity === null) {
            return;
        }

        $lot = (int) $reference->lot_total_quantity;

        $operationIdsOnPivot = ReferenceOperation::query()
            ->where('reference_id', $referenceId)
            ->pluck('operation_id')
            ->unique()
            ->values();

        if ($operationIdsOnPivot->isEmpty()) {
            return;
        }

        $allComplete = true;
        foreach ($operationIdsOnPivot as $opId) {
            $sumForOp = (int) Production::query()
                ->withoutGlobalScopes()
                ->where('reference_id', $referenceId)
                ->where('operation_id', $opId)
                ->sum('quantity');
            if ($sumForOp < $lot) {
                $allComplete = false;
                break;
            }
        }

        if ($allComplete) {
            if ($reference->is_active) {
                $reference->updateQuietly(['is_active' => false]);
            }
            ReferenceOperation::query()
                ->where('reference_id', $referenceId)
                ->update(['is_active' => false]);

            return;
        }

        // Por debajo del tope: reactivar solo si coincide con el cierre automatico por lote
        // (referencia inactiva y todas las operaciones en pivote inactivas).
        $totalPivot = ReferenceOperation::query()->where('reference_id', $referenceId)->count();
        if ($totalPivot === 0) {
            if (! $reference->is_active) {
                $reference->updateQuietly(['is_active' => true]);
            }

            return;
        }

        $inactivePivot = ReferenceOperation::query()
            ->where('reference_id', $referenceId)
            ->where('is_active', false)
            ->count();

        $closedLikeLot = ! $reference->is_active && $inactivePivot === $totalPivot;

        if ($closedLikeLot) {
            $reference->updateQuietly(['is_active' => true]);
            ReferenceOperation::query()
                ->where('reference_id', $referenceId)
                ->update(['is_active' => true]);
        }
    }
}
