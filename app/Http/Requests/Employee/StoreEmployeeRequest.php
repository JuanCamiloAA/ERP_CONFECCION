<?php

namespace App\Http\Requests\Employee;

use App\Models\Bank;
use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('employees.index.create') || $this->user()?->isSuperAdmin();
    }

    public function prepareForValidation(): void
    {
        $acct = trim((string) $this->input('bank_account_number', ''));
        $key = trim((string) $this->input('bank_key', ''));
        $bankId = $this->input('bank_id');

        $merge = [
            'bank_account_number' => $acct === '' ? null : $acct,
            'bank_key' => $key === '' ? null : $key,
            'bank_id' => ($bankId === '' || $bankId === null) ? null : (int) $bankId,
        ];

        $emptyGroup = $merge['bank_id'] === null && $merge['bank_account_number'] === null && $merge['bank_key'] === null;
        if ($emptyGroup) {
            $merge = ['bank_id' => null, 'bank_account_number' => null, 'bank_key' => null];
        }

        $this->merge($merge);
    }

    public function rules(): array
    {
        $companyId = $this->user()?->company_id;

        $bankRules = [
            'bank_id' => [
                'nullable',
                'required_with:bank_account_number,bank_key',
                'integer',
                Rule::exists('banks', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'bank_account_number' => [
                'nullable',
                'required_with:bank_id,bank_key',
                'string',
                'max:34',
                'regex:/^[0-9]+$/',
            ],
            'bank_key' => [
                'nullable',
                'required_with:bank_id,bank_account_number',
                'string',
                'max:100',
                'regex:/^[0-9A-Za-z]+$/',
            ],
        ];

        return [
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'document_type' => ['required', 'string', 'in:CC,CE,TI,PAS,NIT'],
            'document_number' => [
                'required',
                'string',
                'max:30',
                Rule::unique('employees', 'document_number')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['required', 'date'],
            'photo' => ['nullable', 'image', 'max:2048'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'payroll_mode' => ['required', 'string', Rule::in([Employee::PAYROLL_MODE_OPERATIONS, Employee::PAYROLL_MODE_FIXED_DAILY])],
            'daily_salary' => ['nullable', 'required_if:payroll_mode,'.Employee::PAYROLL_MODE_FIXED_DAILY, 'numeric', 'min:0'],
            'minutes_per_full_workday' => ['nullable', 'integer', 'min:60', 'max:1440'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],

            'create_user_account' => ['nullable', 'boolean'],
            'user_email' => [
                'required_if:create_user_account,1',
                'nullable',
                'email',
                'max:120',
                Rule::unique('users', 'email'),
            ],
            'user_role_id' => ['required_if:create_user_account,1', 'nullable', 'integer', 'exists:roles,id'],
        ] + $bankRules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $companyId = $this->user()?->company_id;
            $bankId = $this->input('bank_id');
            if (! $companyId || ! $bankId) {
                return;
            }
            $bank = Bank::withoutGlobalScopes()->where('company_id', $companyId)->find($bankId);
            if (! $bank) {
                $validator->errors()->add('bank_id', 'Banco no valido para esta empresa.');

                return;
            }
            if (! $bank->is_active) {
                $validator->errors()->add('bank_id', 'El banco seleccionado esta inactivo.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'El nombre es obligatorio.',
            'last_name.required' => 'El apellido es obligatorio.',
            'document_number.required' => 'El numero de documento es obligatorio.',
            'document_number.unique' => 'Ya existe un empleado con ese documento.',
            'hire_date.required' => 'La fecha de ingreso es obligatoria.',
            'user_email.required_if' => 'El correo es obligatorio para crear el acceso.',
            'user_email.unique' => 'Ya existe un usuario con ese correo.',
            'user_role_id.required_if' => 'Debes seleccionar un rol para el usuario.',
        ];
    }
}
