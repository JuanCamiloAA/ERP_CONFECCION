<?php

namespace App\Http\Requests\PayrollLegalParameter;

use App\Models\PayrollLegalParameter;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StorePayrollLegalParameterRequest extends FormRequest
{
    /**
     * La autorizacion real la hace PayrollLegalParameterPolicy via authorizeResource() en el
     * controlador (mismo patron que PayrollConceptController/StorePayrollConceptRequest).
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Solo tiene efecto si el usuario autenticado es super_admin; para admin de empresa
            // el controlador siempre asigna su propia company_id sin importar este valor.
            'is_global' => ['nullable', 'boolean'],
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
            $companyId = $this->targetCompanyId();
            $from = $this->input('effective_from');
            $to = $this->input('effective_to');

            if (! $from) {
                return;
            }

            $overlap = PayrollLegalParameter::query()
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

    /**
     * company_id null = fila global (solo si super_admin y is_global=true); en cualquier otro
     * caso, la propia empresa del usuario (nunca un company_id arbitrario enviado por el cliente).
     */
    public function targetCompanyId(): ?int
    {
        $user = $this->user();
        if ($user?->isSuperAdmin() && $this->boolean('is_global')) {
            return null;
        }

        return TenantContext::requireCompanyIdForWrite($user);
    }
}
