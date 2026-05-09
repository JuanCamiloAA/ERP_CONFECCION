<?php

namespace App\Policies;

use App\Models\ExpenseCategory;
use App\Models\User;
use App\Support\TenantContext;

class ExpenseCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        if (! $user->can('expenses.categories.view')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->company_id !== null;
    }

    public function view(User $user, ExpenseCategory $expenseCategory): bool
    {
        if (! $user->can('expenses.categories.view')) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expenseCategory->company_id);
    }

    public function create(User $user): bool
    {
        if (! $user->can('expenses.categories.create')) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return ! TenantContext::isConsolidatedSuperAdmin($user);
        }

        return $user->company_id !== null;
    }

    public function update(User $user, ExpenseCategory $expenseCategory): bool
    {
        if (! $user->can('expenses.categories.edit')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expenseCategory->company_id);
    }

    public function delete(User $user, ExpenseCategory $expenseCategory): bool
    {
        if (! $user->can('expenses.categories.delete')) {
            return false;
        }

        if ($user->isSuperAdmin() && TenantContext::isConsolidatedSuperAdmin($user)) {
            return false;
        }

        return $this->ownsCompanyContext($user, (int) $expenseCategory->company_id);
    }

    protected function ownsCompanyContext(User $user, int $categoryCompanyId): bool
    {
        if ($user->isSuperAdmin()) {
            if (TenantContext::isConsolidatedSuperAdmin($user)) {
                return true;
            }

            $sel = TenantContext::superAdminSelectedCompanyId();

            return $sel !== null && (int) $sel === $categoryCompanyId;
        }

        return (int) $user->company_id === $categoryCompanyId;
    }
}
