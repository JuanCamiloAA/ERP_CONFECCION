<?php

namespace App\Observers;

use App\Models\Employee;

class EmployeeObserver
{
    public function updated(Employee $employee): void
    {
        if (! $employee->user_id) {
            return;
        }

        if ($employee->wasChanged('is_active')) {
            $employee->user?->forceFill([
                'is_active' => (bool) $employee->is_active,
            ])->save();
        }
    }

    public function deleted(Employee $employee): void
    {
        if ($employee->user_id) {
            $employee->user?->forceFill([
                'is_active' => false,
            ])->save();
        }
    }

    public function restored(Employee $employee): void
    {
        if ($employee->user_id) {
            $employee->user?->forceFill([
                'is_active' => true,
            ])->save();
        }
    }
}
