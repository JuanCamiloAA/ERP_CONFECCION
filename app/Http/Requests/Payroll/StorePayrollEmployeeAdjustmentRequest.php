<?php

namespace App\Http\Requests\Payroll;

use App\Models\Payroll;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePayrollEmployeeAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        /** @var Payroll $payroll */
        $payroll = $this->route('payroll');
        $this->merge([
            '_payroll_company_id' => $payroll->company_id,
        ]);
    }

    public function rules(): array
    {
        $companyId = (int) $this->input('_payroll_company_id');

        return [
            'payroll_concept_id' => [
                'required',
                'integer',
                Rule::exists('payroll_concepts', 'id')->where(function ($q) use ($companyId) {
                    $q->where('company_id', $companyId)->where('is_active', true);
                }),
            ],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
