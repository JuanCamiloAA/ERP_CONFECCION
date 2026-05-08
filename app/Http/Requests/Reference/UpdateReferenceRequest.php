<?php

namespace App\Http\Requests\Reference;

use App\Models\Production;
use App\Models\Reference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('references.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;
        $referenceId = $this->route('reference')?->id ?? $this->route('reference');

        return [
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('references', 'code')
                    ->where(fn ($q) => $q->where('company_id', $companyId))
                    ->ignore($referenceId),
            ],
            'name' => ['required', 'string', 'max:120'],
            'payment_per_unit' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:1000'],
            'lot_total_quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'payment_per_unit.numeric' => 'El valor de pago debe ser numerico.',
            'payment_per_unit.min' => 'El valor de pago no puede ser negativo.',
            'lot_total_quantity.required' => 'Indica la cantidad total del lote.',
            'lot_total_quantity.min' => 'La cantidad del lote debe ser al menos 1.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $v = $this->input('payment_per_unit');
        if ($v === '' || $v === null) {
            $this->merge(['payment_per_unit' => null]);
        }
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            /** @var Reference|null $reference */
            $reference = $this->route('reference');
            if (! $reference instanceof Reference) {
                return;
            }

            $newLot = (int) $this->input('lot_total_quantity');
            $perOpTotals = Production::query()
                ->withoutGlobalScopes()
                ->where('reference_id', $reference->id)
                ->selectRaw('SUM(quantity) as s')
                ->groupBy('operation_id')
                ->pluck('s');
            $maxRegisteredSingleOperation = (int) ($perOpTotals->max() ?? 0);

            if ($newLot < $maxRegisteredSingleOperation) {
                $validator->errors()->add(
                    'lot_total_quantity',
                    "No puedes fijar un lote menor al maximo ya registrado en una sola operacion ({$maxRegisteredSingleOperation} unidades)."
                );
            }
        });
    }
}
