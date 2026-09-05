<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

class SendPayrollReceiptsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'payroll_employee_ids' => ['required', 'array', 'min:1'],
            'payroll_employee_ids.*' => ['integer', 'exists:payroll_employees,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'payroll_employee_ids.required' => 'Selecciona al menos un empleado para enviar el comprobante.',
            'payroll_employee_ids.min' => 'Selecciona al menos un empleado para enviar el comprobante.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'payroll_employee_ids' => 'empleados',
        ];
    }
}
