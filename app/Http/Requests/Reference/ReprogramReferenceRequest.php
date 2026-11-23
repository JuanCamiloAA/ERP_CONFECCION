<?php

namespace App\Http\Requests\Reference;

use App\Models\Reference;
use App\Support\ReferenceLotTotals;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReprogramReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('references.index.reprogram') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $reference = $this->route('reference');
        $companyId = $reference instanceof Reference ? $reference->company_id : $this->user()?->company_id;

        return [
            'lot_total_quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'payment_per_unit' => ['required', 'numeric', 'min:0'],

            // La lista completa de operaciones de la programacion nueva: las que no vengan
            // se quitan y las que no tenia se agregan. Sin la clave, el detalle no cambia.
            'operations' => ['sometimes', 'array', 'min:1'],
            'operations.*.operation_id' => [
                'required',
                'integer',
                'distinct',
                // Del catalogo de la misma empresa: el id llega del navegador.
                Rule::exists('operations', 'id')
                    ->where(fn ($q) => $q->where('company_id', $companyId)->whereNull('deleted_at')),
            ],
            'operations.*.price' => ['required', 'numeric', 'min:0'],
            'operations.*.estimated_minutes' => ['nullable', 'numeric', 'min:0.01', 'max:9999.99'],
        ];
    }

    public function messages(): array
    {
        return [
            'lot_total_quantity.required' => 'Indica la cantidad del lote nuevo.',
            'lot_total_quantity.min' => 'La cantidad del lote debe ser al menos 1.',
            'payment_per_unit.required' => 'Indica el valor unitario de pago.',
            'payment_per_unit.numeric' => 'El valor de pago debe ser numerico.',
            'payment_per_unit.min' => 'El valor de pago no puede ser negativo.',
            'operations.min' => 'La programacion nueva necesita al menos una operacion.',
            'operations.*.operation_id.exists' => 'Hay operaciones que no pertenecen al catalogo de la empresa.',
            'operations.*.operation_id.distinct' => 'Una operacion esta repetida.',
            'operations.*.price.required' => 'Cada operacion necesita su precio.',
            'operations.*.price.min' => 'El precio de una operacion no puede ser negativo.',
            'operations.*.estimated_minutes.min' => 'Los minutos de una operacion deben ser mayores que cero.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var Reference|null $reference */
            $reference = $this->route('reference');
            if (! $reference instanceof Reference) {
                return;
            }

            // Sin nada producido, reprogramar solo dejaria una programacion vacia en el
            // historial: lo que se quiere es cambiar la cantidad o el valor, y eso es editar.
            if (! ReferenceLotTotals::currentHasProduction($reference)) {
                $validator->errors()->add(
                    'reprogram',
                    "La programacion {$reference->currentLotNumber()} todavia no tiene produccion registrada. Cambia la cantidad y el valor desde Editar referencia."
                );
            }
        });
    }
}
