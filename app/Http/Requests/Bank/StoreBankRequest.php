<?php

namespace App\Http\Requests\Bank;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBankRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('banks.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return [
            'name' => [
                'required',
                'string',
                'max:160',
                Rule::unique('banks', 'name')->where(
                    fn ($q) => $q->where('company_id', $companyId)->whereNull('deleted_at')
                ),
            ],
            'code' => ['nullable', 'string', 'max:40'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
