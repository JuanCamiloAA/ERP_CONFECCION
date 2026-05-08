<?php

namespace App\Http\Requests\Payroll;

use App\Models\Payroll;
use App\Models\Scopes\CompanyScope;
use App\Support\CompanyContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('payrolls.index.create') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'type' => [
                'required',
                'string',
                'max:50',
                Rule::exists('payroll_periodicities', 'code')->where('is_active', true),
            ],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type');
            $start = $this->input('period_start');
            $end = $this->input('period_end');
            $companyId = CompanyContext::id($this->user());

            if (! $type || ! $start || ! $end || ! $companyId) {
                return;
            }

            $overlap = Payroll::query()
                ->withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->where('type', $type)
                ->where(function ($q) use ($start, $end) {
                    $q->whereBetween('period_start', [$start, $end])
                        ->orWhereBetween('period_end', [$start, $end])
                        ->orWhere(function ($q2) use ($start, $end) {
                            $q2->where('period_start', '<=', $start)
                                ->where('period_end', '>=', $end);
                        });
                })
                ->exists();

            if ($overlap) {
                $validator->errors()->add('period_start', 'El periodo se solapa con otra nomina del mismo tipo.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio.',
            'period_start.required' => 'La fecha inicial es obligatoria.',
            'period_end.required' => 'La fecha final es obligatoria.',
            'period_end.after_or_equal' => 'La fecha final debe ser posterior a la inicial.',
        ];
    }
}
