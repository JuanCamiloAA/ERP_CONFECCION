<?php

namespace App\Http\Requests\Operation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOperationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('operations.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return [
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('operations', 'name')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'estimated_minutes' => ['required', 'numeric', 'min:0.01', 'max:9999.99'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio.',
            'name.unique' => 'Ya existe una operacion con ese nombre.',
            'base_price.required' => 'El precio base es obligatorio.',
            'estimated_minutes.required' => 'Indica los minutos estandar de la operacion.',
            'estimated_minutes.min' => 'Los minutos deben ser mayores a 0.',
        ];
    }
}
