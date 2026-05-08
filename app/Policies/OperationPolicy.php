<?php

namespace App\Policies;

use App\Models\Operation;
use App\Models\User;

class OperationPolicy
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
        return $user->can('operations.index.view');
    }

    public function create(User $user): bool
    {
        return $user->can('operations.index.create');
    }

    public function update(User $user, Operation $operation): bool
    {
        return $operation->company_id === $user->company_id && $user->can('operations.index.edit');
    }

    public function delete(User $user, Operation $operation): bool
    {
        return $operation->company_id === $user->company_id && $user->can('operations.index.delete');
    }
}
