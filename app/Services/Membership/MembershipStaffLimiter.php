<?php

namespace App\Services\Membership;

use App\Models\Company;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class MembershipStaffLimiter
{
    public function staffUsersCount(int $companyId): int
    {
        return User::query()
            ->forCompany($companyId)
            ->staff()
            ->count();
    }

    public function maxStaffUsers(?Company $company): ?int
    {
        $plan = $company?->membershipPlan;

        return $plan?->max_staff_users;
    }

    /**
     * Usuarios de escritorio: company_id definido y employee_id nulo (no cuentan operarios con ficha).
     */
    public function assertCanAddStaffUser(int $companyId, ?User $authUser = null): void
    {
        $company = Company::query()->with('membershipPlan')->find($companyId);
        $max = $this->maxStaffUsers($company);

        if ($max === null) {
            return;
        }

        $current = $this->staffUsersCount($companyId);

        if ($current >= $max) {
            throw ValidationException::withMessages([
                'email' => 'Se alcanzó el límite de usuarios de escritorio (staff) del plan de membresía ('.$current.'/'.$max.'). Los usuarios vinculados a ficha de empleado no cuentan en este tope.',
                'membership_limit' => 'Para añadir más usuarios administrativos debes ampliar el plan de la empresa.',
            ]);
        }
    }
}
