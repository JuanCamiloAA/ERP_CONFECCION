<?php

namespace App\Policies;

use App\Models\Reference;
use App\Models\User;

class ReferencePolicy
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
        return $user->can('references.index.view');
    }

    public function view(User $user, Reference $reference): bool
    {
        return $reference->company_id === $user->company_id
            && ($user->can('references.show.view') || $user->can('references.index.view'));
    }

    public function create(User $user): bool
    {
        return $user->can('references.index.create');
    }

    public function update(User $user, Reference $reference): bool
    {
        return $reference->company_id === $user->company_id && $user->can('references.index.edit');
    }

    public function delete(User $user, Reference $reference): bool
    {
        return $reference->company_id === $user->company_id && $user->can('references.index.delete');
    }
}
