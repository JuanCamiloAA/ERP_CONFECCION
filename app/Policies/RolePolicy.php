<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class RolePolicy
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
        return $user->can('roles.index.view');
    }

    public function view(User $user, Role $role): bool
    {
        if ($role->company_id === null && ! $user->isSuperAdmin()) {
            return false;
        }

        if ($role->company_id !== null && $role->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('roles.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('roles.index.create');
    }

    public function update(User $user, Role $role): bool
    {
        if ($role->is_system) {
            return false;
        }

        if ($role->company_id === null && ! $user->isSuperAdmin()) {
            return false;
        }

        if ($role->company_id !== null && $role->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('roles.index.edit');
    }

    public function delete(User $user, Role $role): bool
    {
        if ($role->is_system) {
            return false;
        }

        if ($role->company_id === null && ! $user->isSuperAdmin()) {
            return false;
        }

        if ($role->company_id !== null && $role->company_id !== $user->company_id) {
            return false;
        }

        return $user->can('roles.index.delete');
    }
}
