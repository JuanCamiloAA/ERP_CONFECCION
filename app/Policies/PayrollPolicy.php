<?php

namespace App\Policies;

use App\Models\Payroll;
use App\Models\User;

class PayrollPolicy
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
        return $user->can('payrolls.index.view');
    }

    public function view(User $user, Payroll $payroll): bool
    {
        return $payroll->company_id === $user->company_id && $user->can('payrolls.show.view');
    }

    public function create(User $user): bool
    {
        return $user->can('payrolls.index.create');
    }

    public function calculate(User $user, Payroll $payroll): bool
    {
        return $payroll->company_id === $user->company_id && $user->can('payrolls.show.calculate');
    }

    public function approve(User $user, Payroll $payroll): bool
    {
        return $payroll->company_id === $user->company_id && $user->can('payrolls.show.approve');
    }

    public function pay(User $user, Payroll $payroll): bool
    {
        return $payroll->company_id === $user->company_id && $user->can('payrolls.show.pay');
    }

    public function delete(User $user, Payroll $payroll): bool
    {
        return $payroll->company_id === $user->company_id && $user->can('payrolls.index.delete');
    }
}
