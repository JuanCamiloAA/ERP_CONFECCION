<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Support\Collection;
use Spatie\Permission\Models\Permission;

/**
 * Que puede hacer exactamente un usuario.
 *
 * Desde que el rol es solo una plantilla, la respuesta es directa: lo que tenga asignado en
 * `model_has_permissions`, ni mas ni menos. Antes habia que reconstruir la cuenta «permisos
 * del rol - denegaciones + concesiones» y nadie podia mirar una pantalla y decir con
 * seguridad que veia esa persona.
 */
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

        return $user->permissions()
            ->orderBy('name')
            ->pluck('name')
            ->unique()
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
     * Excepciones del modelo anterior (rol + grant/deny).
     *
     * Se conserva para poder consultar el historico de lo que se toco antes de que el rol
     * pasara a ser plantilla; ya no interviene en el calculo del permiso efectivo.
     *
     * @deprecated Ver `UserPermissionService`.
     *
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
