<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

class EmployeePolicy
{
    public function before(User $user): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('employees.index.view');
    }

    public function view(User $user, Employee $employee): bool
    {
        if ($employee->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('employees.show.view') || $user->can('employees.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('employees.index.create');
    }

    public function update(User $user, Employee $employee): bool
    {
        if ($employee->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('employees.index.edit');
    }

    public function delete(User $user, Employee $employee): bool
    {
        if ($employee->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('employees.index.delete');
    }

    public function manageAccess(User $user, Employee $employee): bool
    {
        if ($employee->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('users.index.edit') || $user->isAdmin();
    }
}
