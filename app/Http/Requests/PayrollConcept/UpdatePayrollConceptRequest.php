<?php

namespace App\Http\Requests\PayrollConcept;

use App\Models\PayrollConcept;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePayrollConceptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var PayrollConcept $concept */
        $concept = $this->route('payroll_concept');
        $companyId = TenantContext::requireCompanyIdForWrite($this->user());
        $name = mb_strtolower(trim((string) $this->input('name')));

        return [
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('payroll_concepts', 'name')->ignore($concept->id)->where(function ($q) use ($companyId, $name) {
                    return $q->where('company_id', $companyId)
                        ->whereRaw('LOWER(name) = ?', [$name]);
                }),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
