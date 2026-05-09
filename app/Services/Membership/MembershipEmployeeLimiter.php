<?php

namespace App\Services\Membership;

use App\Models\Company;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class MembershipEmployeeLimiter
{
    public function employeesCount(int $companyId): int
    {
        return Employee::query()->where('company_id', $companyId)->count();
    }

    public function maxEmployees(?Company $company): ?int
    {
        return $company?->membershipPlan?->max_employees;
    }

    public function assertCanAddEmployee(int $companyId, ?User $authUser = null): void
    {
        $company = Company::query()->with('membershipPlan')->find($companyId);
        $max = $this->maxEmployees($company);

        if ($max === null) {
            return;
        }

        $current = $this->employeesCount($companyId);

        if ($current >= $max) {
            throw ValidationException::withMessages([
                'document_number' => 'Se alcanzó el límite de empleados del plan de membresía ('.$current.'/'.$max.').',
                'membership_limit' => 'Para añadir más empleados debes ampliar el plan de la empresa.',
            ]);
        }
    }
}
