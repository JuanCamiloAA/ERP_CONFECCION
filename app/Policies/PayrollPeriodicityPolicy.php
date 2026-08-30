<?php

namespace App\Policies;

use App\Models\PayrollPeriodicity;
use App\Models\User;

class PayrollPeriodicityPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('payroll_periodicities.index.view');
    }

    public function view(User $user, PayrollPeriodicity $payrollPeriodicity): bool
    {
        return $user->can('payroll_periodicities.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('payroll_periodicities.index.create');
    }

    /** Reordenar y activar/desactivar no apuntan a una fila concreta, sino a la lista. */
    public function reorder(User $user): bool
    {
        return $user->can('payroll_periodicities.index.reorder');
    }

    public function update(User $user, PayrollPeriodicity $payrollPeriodicity): bool
    {
        return $user->can('payroll_periodicities.index.edit');
    }

    public function toggle(User $user, PayrollPeriodicity $payrollPeriodicity): bool
    {
        return $user->can('payroll_periodicities.index.toggle');
    }

    public function delete(User $user, PayrollPeriodicity $payrollPeriodicity): bool
    {
        return $user->can('payroll_periodicities.index.delete');
    }
}
