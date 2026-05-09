<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        $companyId = $this->route('company')?->id ?? $this->route('company');

        return [
            'name' => ['required', 'string', 'max:120'],
            'nit' => ['nullable', 'string', 'max:30', Rule::unique('companies', 'nit')->ignore($companyId)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
            'settings' => ['nullable', 'array'],
            'membership_plan_id' => ['nullable', 'integer', 'exists:membership_plans,id'],
            'membership_started_at' => ['nullable', 'date'],
            'membership_ends_at' => ['nullable', 'date', 'after_or_equal:membership_started_at'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('membership_plan_id') === '' || $this->input('membership_plan_id') === null) {
            $this->merge(['membership_plan_id' => null]);
        }
        foreach (['membership_started_at', 'membership_ends_at'] as $key) {
            if ($this->input($key) === '') {
                $this->merge([$key => null]);
            }
        }
    }
}
