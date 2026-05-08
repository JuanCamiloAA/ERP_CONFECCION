<?php

namespace App\Policies;

use App\Models\Production;
use App\Models\User;

class ProductionPolicy
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
        return $user->can('productions.index.view');
    }

    public function view(User $user, Production $production): bool
    {
        if ($production->company_id !== $user->company_id) {
            return false;
        }

        if ($user->isEmployee() && ! $user->isAdmin() && $production->employee_id !== $user->employee_id) {
            return false;
        }

        return $user->can('productions.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('productions.index.create');
    }

    public function update(User $user, Production $production): bool
    {
        return $production->company_id === $user->company_id && $user->can('productions.index.edit');
    }

    public function delete(User $user, Production $production): bool
    {
        return $production->company_id === $user->company_id && $user->can('productions.index.delete');
    }
}
