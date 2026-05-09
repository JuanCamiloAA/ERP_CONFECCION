<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;
use App\Support\TenantContext;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        if (! $user->can('expenses.index.view')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->company_id !== null;
    }

    public function view(User $user, Expense $expense): bool
    {
        if (! $user->can('expenses.index.view')) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expense->company_id);
    }

    public function create(User $user): bool
    {
        if (! $user->can('expenses.index.create')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return ! TenantContext::isConsolidatedSuperAdmin($user);
        }

        return $user->company_id !== null;
    }

    public function update(User $user, Expense $expense): bool
    {
        if (! $user->can('expenses.index.edit')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expense->company_id);
    }

    public function delete(User $user, Expense $expense): bool
    {
        if (! $user->can('expenses.index.delete')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expense->company_id);
    }

    protected function ownsCompanyContext(User $user, int $expenseCompanyId): bool
    {
        if ($user->isSuperAdmin()) {
            if (TenantContext::isConsolidatedSuperAdmin($user)) {
                return true;
            }

            $sel = TenantContext::superAdminSelectedCompanyId();

            return $sel !== null && (int) $sel === $expenseCompanyId;
        }

        return (int) $user->company_id === $expenseCompanyId;
    }
}
