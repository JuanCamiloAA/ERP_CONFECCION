<?php

namespace App\Http\Requests\Reference;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('references.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return [
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('references', 'code')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'name' => ['required', 'string', 'max:120'],
            'payment_per_unit' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:1000'],
            'lot_total_quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
            'operations' => ['nullable', 'array'],
            'operations.*.operation_id' => ['required', 'integer', 'exists:operations,id'],
            'operations.*.price' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'El codigo es obligatorio.',
            'code.unique' => 'Ya existe una referencia con ese codigo.',
            'name.required' => 'El nombre es obligatorio.',
            'payment_per_unit.required' => 'Indique el valor unitario de pago.',
            'payment_per_unit.numeric' => 'El valor de pago debe ser numerico.',
            'payment_per_unit.min' => 'El valor de pago no puede ser negativo.',
            'lot_total_quantity.required' => 'Indica la cantidad total del lote.',
            'lot_total_quantity.min' => 'La cantidad del lote debe ser al menos 1.',
        ];
    }
}
