<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->isSuperAdmin()) {
            if ($ability === 'managePermissionOverrides') {
                return null;
            }

            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('users.index.view');
    }

    public function view(User $user, User $target): bool
    {
        if ($target->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('users.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('users.index.create');
    }

    public function update(User $user, User $target): bool
    {
        if ($target->company_id !== $user->company_id) {
            return false;
        }

        if ($target->hasRole('super_admin') && ! $user->isSuperAdmin()) {
            return false;
        }

        return $user->can('users.index.edit');
    }

    public function managePermissionOverrides(User $actor, User $target): bool
    {
        if ($target->isSuperAdmin()) {
            return false;
        }

        if ($actor->isSuperAdmin()) {
            return true;
        }

        if ((int) $actor->company_id !== (int) $target->company_id) {
            return false;
        }

        return $actor->can('users.edit.permission_overrides');
    }

    public function delete(User $user, User $target): bool
    {
        if ($target->id === $user->id) {
            return false;
        }

        if ($target->hasRole('super_admin')) {
            return false;
        }

        if ($target->employee_id) {
            return false;
        }

        return $user->can('users.index.delete');
    }
}
