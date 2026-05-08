<?php

namespace App\Support;

use App\Models\Production;
use App\Models\Reference;
use Illuminate\Validation\Validator;

class ReferenceLotCapacity
{
    /**
     * Valida que la cantidad no supere el tope del lote para la pareja referencia + operacion
     * (cada operacion puede llegar hasta lot_total_quantity de forma independiente).
     */
    public static function assertWithinLot(Validator $validator, int $referenceId, int $operationId, int $quantity, ?int $excludeProductionId = null): void
    {
        $reference = Reference::query()->find($referenceId);

        if (! $reference || $reference->lot_total_quantity === null || $operationId < 1) {
            return;
        }

        $sum = (int) Production::query()
            ->withoutGlobalScopes()
            ->where('reference_id', $referenceId)
            ->where('operation_id', $operationId)
            ->when($excludeProductionId, fn ($q) => $q->where('id', '!=', $excludeProductionId))
            ->sum('quantity');

        if ($sum + $quantity > $reference->lot_total_quantity) {
            $remaining = max(0, $reference->lot_total_quantity - $sum);
            $validator->errors()->add(
                'quantity',
                "La cantidad supera el tope del lote para esta operacion (maximo {$reference->lot_total_quantity} unidades). Disponible ahora para esta operacion: {$remaining}."
            );
        }
    }
}
