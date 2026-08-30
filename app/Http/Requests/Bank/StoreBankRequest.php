<?php

namespace App\Http\Requests\Bank;

use App\Http\Requests\Bank\Concerns\ValidatesBankLogo;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBankRequest extends FormRequest
{
    use ValidatesBankLogo;

    public function authorize(): bool
    {
        return $this->user()?->can('banks.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        return array_merge([
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
        ], $this->brandRules());
    }

    public function messages(): array
    {
        return array_merge([
            'name.required' => 'El nombre del banco es obligatorio.',
            'name.unique' => 'Ya existe un banco con ese nombre en esta empresa.',
        ], $this->brandMessages());
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(fn (Validator $v) => $this->validateLogoContent($v));
    }
}
