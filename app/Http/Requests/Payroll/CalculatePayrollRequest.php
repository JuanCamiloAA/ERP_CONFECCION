<?php

namespace App\Http\Requests\Payroll;

use App\Models\Employee;
use App\Support\CompanyContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CalculatePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('payrolls.show.calculate') || $this->user()?->isSuperAdmin();
    }

    public function rules(): array
    {
        return [
            'employee_adjustments' => ['nullable', 'array'],
            'employee_adjustments.*.employee_id' => ['required', 'integer', 'exists:employees,id'],
            'employee_adjustments.*.sessions' => ['nullable', 'array'],
            'employee_adjustments.*.sessions.*.session_id' => ['required', 'integer', 'exists:work_day_sessions,id'],
            'employee_adjustments.*.sessions.*.clock_in_at' => ['nullable', 'date'],
            'employee_adjustments.*.sessions.*.clock_out_at' => ['nullable', 'date'],
            'employee_adjustments.*.sessions.*.duration_minutes' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'employee_adjustments.*.sessions.*.reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $this->user()?->can('payrolls.show.edit_time') && ! empty($this->input('employee_adjustments'))) {
                $validator->errors()->add('employee_adjustments', 'No tienes permiso para ajustar tiempos de jornada.');
            }

            $companyId = CompanyContext::id($this->user());
            if (! $companyId || empty($this->input('employee_adjustments'))) {
                return;
            }

            foreach ($this->input('employee_adjustments', []) as $i => $block) {
                $eid = (int) ($block['employee_id'] ?? 0);
                $emp = Employee::query()->withoutGlobalScopes()->where('company_id', $companyId)->find($eid);
                if (! $emp) {
                    $validator->errors()->add("employee_adjustments.{$i}.employee_id", 'Empleado no valido.');
                }
            }
        });
    }
}
