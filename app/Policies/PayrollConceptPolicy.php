<?php

namespace App\Policies;

use App\Models\PayrollConcept;
use App\Models\User;
use App\Support\TenantContext;

class PayrollConceptPolicy
{
    public function viewAny(User $user): bool
    {
        if (! $user->can('payroll_concepts.index.view')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->company_id !== null;
    }

    public function view(User $user, PayrollConcept $payrollConcept): bool
    {
        if (! $user->can('payroll_concepts.index.view')) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $payrollConcept->company_id);
    }

    public function create(User $user): bool
    {
        if (! $user->can('payroll_concepts.index.create')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return ! TenantContext::isConsolidatedSuperAdmin($user);
        }

        return $user->company_id !== null;
    }

    public function update(User $user, PayrollConcept $payrollConcept): bool
    {
        if (! $user->can('payroll_concepts.index.edit')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $payrollConcept->company_id);
    }

    public function delete(User $user, PayrollConcept $payrollConcept): bool
    {
        if (! $user->can('payroll_concepts.index.delete')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $payrollConcept->company_id);
    }

    protected function ownsCompanyContext(User $user, int $conceptCompanyId): bool
    {
        if ($user->isSuperAdmin()) {
            if (TenantContext::isConsolidatedSuperAdmin($user)) {
                return true;
            }

            $sel = TenantContext::superAdminSelectedCompanyId();

            return $sel !== null && (int) $sel === $conceptCompanyId;
        }

        return (int) $user->company_id === $conceptCompanyId;
    }
}
