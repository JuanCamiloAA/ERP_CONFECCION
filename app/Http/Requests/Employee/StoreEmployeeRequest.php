<?php

namespace App\Http\Requests\Employee;

use App\Http\Requests\Concerns\ValidatesAccessPassword;
use App\Models\Bank;
use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreEmployeeRequest extends FormRequest
{
    use ValidatesAccessPassword;

    public function authorize(): bool
    {
        return $this->user()?->can('employees.index.create') || $this->user()?->isSuperAdmin();
    }

    public function prepareForValidation(): void
    {
        $acct = trim((string) $this->input('bank_account_number', ''));
        $key = trim((string) $this->input('bank_key', ''));
        $type = trim((string) $this->input('bank_account_type', ''));
        $bankId = $this->input('bank_id');

        $merge = [
            'bank_account_number' => $acct === '' ? null : $acct,
            'bank_key' => $key === '' ? null : $key,
            'bank_account_type' => $type === '' ? null : mb_strtolower($type),
            'bank_id' => ($bankId === '' || $bankId === null) ? null : (int) $bankId,
        ];

        $emptyGroup = $merge['bank_id'] === null && $merge['bank_account_number'] === null && $merge['bank_key'] === null;
        if ($emptyGroup) {
            $merge = [
                'bank_id' => null,
                'bank_account_number' => null,
                'bank_key' => null,
                'bank_account_type' => null,
            ];
        }

        // Una billetera digital no tiene tipo de cuenta; si llegara, se descarta.
        if ($merge['bank_id'] !== null && $this->selectedBank()?->type === 'wallet') {
            $merge['bank_account_type'] = null;
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
                // Condicional y no `required_with`: hay entidades que no piden clave de
                // dispersion (Nequi y demas billeteras), y exigirla dejaria esos datos de
                // pago sin poder guardarse.
                Rule::requiredIf(fn () => $this->input('bank_id') !== null && $this->bankRequiresKey()),
                'string',
                'max:100',
                'regex:/^[0-9A-Za-z]+$/',
            ],
            'bank_account_type' => ['nullable', 'string', Rule::in(['ahorros', 'corriente'])],
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
            'base_salary' => [
                'nullable',
                'required_if:payroll_mode,'.Employee::PAYROLL_MODE_HOURLY_LEGAL,
                'numeric',
                'min:0',
            ],
            'payroll_mode' => ['required', 'string', Rule::in([
                Employee::PAYROLL_MODE_OPERATIONS,
                Employee::PAYROLL_MODE_FIXED_DAILY,
                Employee::PAYROLL_MODE_HOURLY_LEGAL,
            ])],
            'daily_salary' => ['nullable', 'required_if:payroll_mode,'.Employee::PAYROLL_MODE_FIXED_DAILY, 'numeric', 'min:0'],
            'minutes_per_full_workday' => ['nullable', 'integer', 'min:60', 'max:1440'],
            'ordinary_hours_per_day' => [
                'nullable',
                'required_if:payroll_mode,'.Employee::PAYROLL_MODE_HOURLY_LEGAL,
                'numeric',
                'min:1',
                'max:12',
            ],
            'is_exempt_from_overtime' => ['nullable', 'boolean'],
            'scheduled_work_days' => ['nullable', 'array'],
            'scheduled_work_days.*' => ['integer', 'min:1', 'max:7'],
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
        ] + $bankRules + $this->accessPasswordRules();
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
            'base_salary.required_if' => 'El salario base es obligatorio para la modalidad por horas (legal).',
            'ordinary_hours_per_day.required_if' => 'Indica la jornada ordinaria diaria para la modalidad por horas (legal).',
            'bank_key.required' => 'Este banco exige clave de dispersión.',
            'bank_account_type.in' => 'El tipo de cuenta debe ser ahorros o corriente.',
        ] + $this->accessPasswordMessages();
    }

    /** Banco elegido en la peticion, si existe y es de la empresa. */
    protected function selectedBank(): ?Bank
    {
        $bankId = $this->input('bank_id');

        if ($bankId === null || $bankId === '') {
            return null;
        }

        return Bank::query()
            ->withoutGlobalScopes()
            ->where('company_id', $this->user()?->company_id)
            ->find((int) $bankId);
    }

    /** Por defecto se exige clave: es lo que hacia la regla anterior para todos los bancos. */
    protected function bankRequiresKey(): bool
    {
        return $this->selectedBank()?->requires_key ?? true;
    }
}
