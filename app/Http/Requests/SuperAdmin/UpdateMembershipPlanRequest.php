<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMembershipPlanRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['max_staff_users', 'max_employees', 'price_monthly'] as $key) {
            if ($this->input($key) === '') {
                $this->merge([$key => null]);
            }
        }

        if ($this->has('slug')) {
            $this->merge(['slug' => str_replace('_', '-', (string) $this->input('slug'))]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    public function rules(): array
    {
        $planId = $this->route('membership_plan')?->id ?? $this->route('membership_plan');

        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9\-]+$/', Rule::unique('membership_plans', 'slug')->ignore($planId)],
            'max_staff_users' => ['nullable', 'integer', 'min:0'],
            'max_employees' => ['nullable', 'integer', 'min:0'],
            'features_json' => ['nullable', 'array'],
            'price_monthly' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
