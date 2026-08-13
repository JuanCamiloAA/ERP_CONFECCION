<?php

namespace App\Http\Requests\Payroll;

use App\Models\Advance;
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

            'absence_confirmations' => ['nullable', 'array'],
            'absence_confirmations.*.employee_id' => ['required', 'integer', 'exists:employees,id'],
            'absence_confirmations.*.dates' => ['nullable', 'array'],
            'absence_confirmations.*.dates.*.date' => ['required', 'date'],
            'absence_confirmations.*.dates.*.discount' => ['nullable', 'boolean'],
            'absence_confirmations.*.dates.*.note' => ['nullable', 'string', 'max:500'],

            'advance_adjustments' => ['nullable', 'array'],
            'advance_adjustments.*.employee_id' => ['required', 'integer', 'exists:employees,id'],
            'advance_adjustments.*.advances' => ['nullable', 'array'],
            'advance_adjustments.*.advances.*.advance_id' => ['required', 'integer', 'exists:advances,id'],
            'advance_adjustments.*.advances.*.applied_amount' => ['required', 'numeric', 'min:0.01'],
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

            foreach ($this->input('absence_confirmations', []) as $i => $block) {
                $eid = (int) ($block['employee_id'] ?? 0);
                $emp = Employee::query()->withoutGlobalScopes()->where('company_id', $companyId)->find($eid);
                if (! $emp) {
                    $validator->errors()->add("absence_confirmations.{$i}.employee_id", 'Empleado no valido.');
                }
            }
        });

        $validator->after(function (Validator $validator) {
            $companyId = CompanyContext::id($this->user());
            if (! $companyId) {
                return;
            }

            foreach ($this->input('advance_adjustments', []) as $i => $block) {
                $eid = (int) ($block['employee_id'] ?? 0);

                foreach ($block['advances'] ?? [] as $j => $row) {
                    $advanceId = (int) ($row['advance_id'] ?? 0);
                    $applied = (float) ($row['applied_amount'] ?? 0);

                    $advance = Advance::query()
                        ->withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('employee_id', $eid)
                        ->find($advanceId);

                    if (! $advance) {
                        $validator->errors()->add(
                            "advance_adjustments.{$i}.advances.{$j}.advance_id",
                            'Anticipo no valido.'
                        );

                        continue;
                    }

                    if ($applied > (float) $advance->remaining_amount + 0.005) {
                        $validator->errors()->add(
                            "advance_adjustments.{$i}.advances.{$j}.applied_amount",
                            'El monto a descontar no puede superar el saldo pendiente del anticipo ($'.
                                number_format((float) $advance->remaining_amount, 2).').'
                        );
                    }
                }
            }
        });
    }
}
