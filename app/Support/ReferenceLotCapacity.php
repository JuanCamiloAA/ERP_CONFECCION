<?php

namespace App\Support;

use App\Models\Reference;
use Illuminate\Validation\Validator;

class ReferenceLotCapacity
{
    /**
     * Valida que la cantidad no supere el tope del lote para la pareja referencia + operacion
     * (cada operacion puede llegar hasta lot_total_quantity de forma independiente).
     *
     * Se mide contra una programacion: la vigente por defecto. Al corregir un registro de
     * una programacion ya cerrada se pasa la suya, para que se compare con el lote que tenia
     * y no con el de la programacion nueva.
     */
    public static function assertWithinLot(
        Validator $validator,
        int $referenceId,
        int $operationId,
        int $quantity,
        ?int $excludeProductionId = null,
        ?int $lotNumber = null,
    ): void {
        $reference = Reference::query()->find($referenceId);

        if (! $reference || $operationId < 1) {
            return;
        }

        $current = $reference->currentLotNumber();
        $lotNumber ??= $current;
        $cap = $reference->lotQuantityFor($lotNumber);

        if ($cap === null) {
            return;
        }

        $sum = ReferenceLotTotals::byOperation($referenceId, $lotNumber, $excludeProductionId)[$operationId] ?? 0;

        if ($sum + $quantity > $cap) {
            $remaining = max(0, $cap - $sum);
            $where = $lotNumber === $current ? 'esta operacion' : "esta operacion en la programacion {$lotNumber}";

            $validator->errors()->add(
                'quantity',
                "La cantidad supera el tope del lote para {$where} (maximo {$cap} unidades). Disponible ahora: {$remaining}."
            );
        }
    }
}
