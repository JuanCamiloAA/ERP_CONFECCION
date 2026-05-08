<?php

namespace App\Http\Requests\Bank;

use App\Models\Bank;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateBankRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('banks.index.edit') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;
        /** @var Bank|null $bank */
        $bank = $this->route('bank');

        return [
            'name' => [
                'required',
                'string',
                'max:160',
                Rule::unique('banks', 'name')
                    ->where(fn ($q) => $q->where('company_id', $companyId)->whereNull('deleted_at'))
                    ->ignore($bank?->id),
            ],
            'code' => ['nullable', 'string', 'max:40'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
