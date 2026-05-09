<?php

namespace App\Http\Requests\Landing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLandingPlanInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $id = $this->input('membership_plan_id');
        if ($id === '' || $id === null) {
            $this->merge(['membership_plan_id' => null]);

            return;
        }
        if (is_numeric($id)) {
            $this->merge(['membership_plan_id' => (int) $id]);
        }
    }

    public function rules(): array
    {
        return [
            'company_name' => ['required', 'string', 'max:200'],
            'company_tax_id' => ['nullable', 'string', 'max:64'],
            'company_phone' => ['nullable', 'string', 'max:40'],
            'company_email' => ['nullable', 'email', 'max:255'],
            'admin_full_name' => ['required', 'string', 'max:200'],
            'admin_email' => ['required', 'email', 'max:255'],
            'admin_phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:2000'],
            'membership_plan_id' => [
                'nullable',
                'integer',
                Rule::exists('membership_plans', 'id')->where('is_active', true),
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'company_name' => 'nombre de la empresa',
            'company_tax_id' => 'NIT o documento',
            'company_phone' => 'teléfono de la empresa',
            'company_email' => 'correo de la empresa',
            'admin_full_name' => 'nombre del administrador',
            'admin_email' => 'correo del administrador',
            'admin_phone' => 'teléfono del administrador',
            'message' => 'mensaje',
            'membership_plan_id' => 'plan',
        ];
    }
}
