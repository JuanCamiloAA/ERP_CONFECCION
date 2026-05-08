<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Support\Collection;
use Spatie\Permission\Models\Permission;

class EffectivePermissionService
{
    /**
     * @return list<string>
     */
    public function getEffectivePermissionNames(User $user): array
    {
        if ($user->isSuperAdmin()) {
            return Permission::query()->orderBy('name')->pluck('name')->all();
        }

        $base = $user->getAllPermissions()->pluck('name');

        $effects = UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->join('permissions', 'user_permission_overrides.permission_id', '=', 'permissions.id')
            ->selectRaw('permissions.name as name, user_permission_overrides.effect as effect')
            ->get();

        $deny = $effects->where('effect', UserPermissionOverride::EFFECT_DENY)->pluck('name');
        $grant = $effects->where('effect', UserPermissionOverride::EFFECT_GRANT)->pluck('name');

        return $base
            ->diff($deny)
            ->merge($grant)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function userHasEffectivePermission(User $user, string $permissionName): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return in_array($permissionName, $this->getEffectivePermissionNames($user), true);
    }

    /**
     * @return Collection<int, UserPermissionOverride>
     */
    public function listOverridesForUser(User $user): Collection
    {
        return UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->with('permission:id,name')
            ->orderBy('permission_id')
            ->get();
    }
}
