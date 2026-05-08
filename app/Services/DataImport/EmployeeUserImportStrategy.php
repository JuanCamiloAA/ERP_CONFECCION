<?php

namespace App\Services\DataImport;

use App\Models\Bank;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class EmployeeUserImportStrategy implements ImportStrategyInterface
{
    public function processRow(array $row, int $lineNumber, DataImportContext $ctx): void
    {
        $companyNit = trim((string) ($row['company_nit'] ?? ''));
        $firstName = trim((string) ($row['first_name'] ?? ''));
        $lastName = trim((string) ($row['last_name'] ?? ''));
        $documentNumber = trim((string) ($row['document_number'] ?? ''));

        if ($companyNit === '') {
            throw new RowImportException('Falta company_nit.', $lineNumber);
        }
        if ($firstName === '' || $lastName === '') {
            throw new RowImportException('Falta first_name o last_name.', $lineNumber);
        }
        if ($documentNumber === '') {
            throw new RowImportException('Falta document_number.', $lineNumber);
        }

        $companyId = $ctx->resolveCompanyId($companyNit);
        if (! $companyId) {
            throw new RowImportException('Empresa no encontrada para company_nit.', $lineNumber);
        }

        $documentType = strtoupper(trim((string) ($row['document_type'] ?? 'CC')));
        if ($documentType === '') {
            $documentType = 'CC';
        }
        $allowedDocs = ['CC', 'CE', 'TI', 'PAS', 'NIT'];
        if (! in_array($documentType, $allowedDocs, true)) {
            throw new RowImportException('document_type invalido.', $lineNumber);
        }

        $payrollMode = strtolower(trim((string) ($row['payroll_mode'] ?? Employee::PAYROLL_MODE_OPERATIONS)));
        if (! in_array($payrollMode, [Employee::PAYROLL_MODE_OPERATIONS, Employee::PAYROLL_MODE_FIXED_DAILY], true)) {
            $payrollMode = Employee::PAYROLL_MODE_OPERATIONS;
        }

        $dailySalary = null;
        if ($payrollMode === Employee::PAYROLL_MODE_FIXED_DAILY) {
            $ds = $row['daily_salary'] ?? null;
            if ($ds === null || trim((string) $ds) === '') {
                throw new RowImportException('daily_salary obligatorio si payroll_mode es fixed_daily.', $lineNumber);
            }
            $dailySalary = (float) str_replace(',', '.', (string) $ds);
        }

        $hireDate = $this->parseDate($row['hire_date'] ?? null);
        $baseSalaryRaw = $row['base_salary'] ?? null;
        $baseSalary = 0.0;
        if ($baseSalaryRaw !== null && trim((string) $baseSalaryRaw) !== '') {
            $baseSalary = (float) str_replace(',', '.', (string) $baseSalaryRaw);
        }

        $bankName = trim((string) ($row['bank_name'] ?? ''));
        $bankAccount = trim((string) ($row['bank_account_number'] ?? ''));
        $bankKey = trim((string) ($row['bank_key'] ?? ''));

        $anyBank = $bankName !== '' || $bankAccount !== '' || $bankKey !== '';
        if ($anyBank) {
            if ($bankName === '' || $bankAccount === '' || $bankKey === '') {
                throw new RowImportException('Datos bancarios: indique bank_name, bank_account_number y bank_key juntos.', $lineNumber);
            }
            if (! preg_match('/^[0-9]+$/', $bankAccount)) {
                throw new RowImportException('bank_account_number solo digitos.', $lineNumber);
            }
            if (! preg_match('/^[0-9A-Za-z]+$/', $bankKey)) {
                throw new RowImportException('bank_key solo letras y numeros.', $lineNumber);
            }
        }

        $bankId = null;
        if ($bankName !== '') {
            $bank = Bank::query()->withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereNull('deleted_at')
                ->where('is_active', true)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($bankName)])
                ->first();
            if (! $bank) {
                throw new RowImportException('Banco no encontrado o inactivo para bank_name.', $lineNumber);
            }
            $bankId = (int) $bank->id;
        }

        $createUser = $this->parseBool($row['create_user'] ?? null, false);
        $userEmail = strtolower(trim((string) ($row['user_email'] ?? '')));
        $roleName = trim((string) ($row['role_name'] ?? ''));

        if ($createUser) {
            if ($userEmail === '' || ! filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
                throw new RowImportException('user_email obligatorio y valido si create_user=1.', $lineNumber);
            }
            if ($roleName === '') {
                throw new RowImportException('role_name obligatorio si create_user=1.', $lineNumber);
            }
            if (mb_strtolower($roleName) === 'super_admin') {
                throw new RowImportException('No se puede asignar rol super_admin por importacion.', $lineNumber);
            }
        }

        $employee = Employee::query()->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('document_number', $documentNumber)
            ->whereNull('deleted_at')
            ->first();

        if ($employee && ! $ctx->employeeUpdateExisting) {
            throw new RowImportException('Empleado ya existe (active update_existing=1 para actualizar).', $lineNumber);
        }

        if ($createUser) {
            $existingUser = User::query()->where('email', $userEmail)->first();
            if ($existingUser) {
                $sameEmployee = $employee && (int) $existingUser->employee_id === (int) $employee->id;
                if (! $sameEmployee) {
                    throw new RowImportException('El correo user_email ya esta en uso.', $lineNumber);
                }
            }
        }

        DB::transaction(function () use (
            $employee,
            $companyId,
            $firstName,
            $lastName,
            $documentType,
            $documentNumber,
            $payrollMode,
            $dailySalary,
            $hireDate,
            $baseSalary,
            $bankId,
            $bankAccount,
            $bankKey,
            $createUser,
            $userEmail,
            $roleName,
            $row,
            $lineNumber,
        ) {
            $payload = [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'document_type' => $documentType,
                'document_number' => $documentNumber,
                'phone' => $this->nullable($row['phone'] ?? null, 50),
                'email' => $this->nullableEmail($row['email'] ?? null),
                'address' => $this->nullable($row['address'] ?? null, 255),
                'hire_date' => $hireDate,
                'base_salary' => $baseSalary,
                'payroll_mode' => $payrollMode,
                'daily_salary' => $payrollMode === Employee::PAYROLL_MODE_FIXED_DAILY ? $dailySalary : null,
                'minutes_per_full_workday' => 480,
                'bank_id' => $bankId,
                'bank_account_number' => $bankId ? $bankAccount : null,
                'bank_key' => $bankId ? $bankKey : null,
                'is_active' => $this->parseBool($row['is_active'] ?? null, true),
                'notes' => $this->nullableNotes($row['notes'] ?? null),
            ];

            if ($employee) {
                $employee->update($payload);
                $target = $employee->fresh();
            } else {
                $payload['company_id'] = $companyId;
                $target = Employee::create($payload);
            }

            if ($createUser && ! $target->user_id) {
                $role = Role::query()
                    ->where('name', $roleName)
                    ->where('guard_name', 'web')
                    ->where('company_id', $companyId)
                    ->first()
                    ?? Role::query()
                        ->where('name', $roleName)
                        ->where('guard_name', 'web')
                        ->whereNull('company_id')
                        ->first();

                if (! $role) {
                    throw new RowImportException('Rol no encontrado para la empresa: '.$roleName, $lineNumber);
                }

                $passwordPlain = trim((string) ($row['user_password'] ?? ''));
                $mustChange = false;
                if ($passwordPlain === '') {
                    $passwordPlain = $this->generateTemporaryPassword();
                    $mustChange = true;
                }

                $newUser = User::create([
                    'company_id' => $companyId,
                    'employee_id' => $target->id,
                    'name' => $target->first_name,
                    'last_name' => $target->last_name,
                    'email' => $userEmail,
                    'password' => Hash::make($passwordPlain),
                    'phone' => $target->phone,
                    'is_active' => true,
                    'password_change_required' => $mustChange,
                ]);

                $newUser->assignRole($role);

                $target->user_id = $newUser->id;
                $target->save();
            }
        });
    }

    protected function parseDate(mixed $v): \Carbon\CarbonInterface
    {
        if ($v === null || trim((string) $v) === '') {
            return now()->startOfDay();
        }

        try {
            return \Carbon\Carbon::parse((string) $v)->startOfDay();
        } catch (\Throwable) {
            return now()->startOfDay();
        }
    }

    protected function nullable(mixed $v, int $max): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        $s = trim((string) $v);

        return $s === '' ? null : mb_substr($s, 0, $max);
    }

    protected function nullableEmail(mixed $v): ?string
    {
        $s = $this->nullable($v, 120);
        if ($s === null) {
            return null;
        }

        return filter_var($s, FILTER_VALIDATE_EMAIL) ? $s : null;
    }

    protected function nullableNotes(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }

        $s = trim((string) $v);

        return $s === '' ? null : Str::limit($s, 1000);
    }

    protected function parseBool(mixed $v, bool $default): bool
    {
        if ($v === null || $v === '') {
            return $default;
        }

        $s = strtolower(trim((string) $v));

        if (in_array($s, ['1', 'true', 'yes', 'si', 'sí'], true)) {
            return true;
        }

        if (in_array($s, ['0', 'false', 'no'], true)) {
            return false;
        }

        return $default;
    }

    protected function generateTemporaryPassword(): string
    {
        $upper = Str::upper(Str::random(2));
        $lower = Str::lower(Str::random(4));
        $number = (string) random_int(100, 999);
        $special = collect(['#', '@', '$', '%', '!', '&'])->random();

        return $upper.$lower.$number.$special;
    }
}
