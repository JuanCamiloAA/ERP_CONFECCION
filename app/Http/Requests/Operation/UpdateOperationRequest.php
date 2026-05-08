<?php

namespace App\Http\Requests\Operation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOperationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('operations.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;
        $operationId = $this->route('operation')?->id ?? $this->route('operation');

        return [
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('operations', 'name')
                    ->where(fn ($q) => $q->where('company_id', $companyId))
                    ->ignore($operationId),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
