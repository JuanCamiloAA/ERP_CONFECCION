<?php

namespace App\Http\Requests\PayrollLegalParameter;

use App\Models\PayrollLegalParameter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdatePayrollLegalParameterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after:effective_from'],
            'weekly_legal_hours' => ['required', 'numeric', 'min:1', 'max:80'],
            'monthly_hours_divisor' => ['required', 'numeric', 'min:1', 'max:400'],
            'night_start_time' => ['required', 'date_format:H:i'],
            'night_end_time' => ['required', 'date_format:H:i'],
            'night_surcharge_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'overtime_day_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'overtime_night_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'sunday_holiday_surcharge_percent' => ['required', 'numeric', 'min:0', 'max:500'],
            'max_overtime_hours_per_day' => ['required', 'numeric', 'min:0', 'max:24'],
            'max_overtime_hours_per_week' => ['required', 'numeric', 'min:0', 'max:168'],
            'discount_unexcused_absences' => ['nullable', 'boolean'],
            'absence_discount_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'legal_reference' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var PayrollLegalParameter|null $parameter */
            $parameter = $this->route('payroll_legal_parameter');
            if (! $parameter instanceof PayrollLegalParameter) {
                return;
            }

            $from = $this->input('effective_from');
            $to = $this->input('effective_to');
            $companyId = $parameter->company_id;

            $overlap = PayrollLegalParameter::query()
                ->where('id', '!=', $parameter->id)
                ->where(fn ($q) => $companyId === null ? $q->whereNull('company_id') : $q->where('company_id', $companyId))
                ->where(function ($q) use ($from, $to) {
                    $q->where('effective_from', '<=', $to ?? '9999-12-31')
                        ->where(function ($q2) use ($from) {
                            $q2->whereNull('effective_to')->orWhere('effective_to', '>=', $from);
                        });
                })
                ->exists();

            if ($overlap) {
                $validator->errors()->add('effective_from', 'El rango se solapa con otro tramo existente para este alcance (global o de la empresa).');
            }
        });
    }
}
