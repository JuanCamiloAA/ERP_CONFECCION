<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * El rol como plantilla de permisos.
 *
 * Cambiar un rol ya no se propaga solo. Antes, tocar «Auxiliar contable» alteraba en
 * silencio lo que podian hacer todas las personas con ese rol —incluidas las que alguien
 * habia ajustado a mano—. Ahora el cambio se guarda en la plantilla y se ofrece aplicarlo,
 * eligiendo a quien; lo que se aplica es la diferencia, no la plantilla entera, para no
 * borrar los ajustes propios de cada usuario.
 */
class RoleTemplateService
{
    /** Clave de sesion donde espera el cambio pendiente de propagar, por rol. */
    public const PENDING_SESSION_PREFIX = 'role_permission_diff.';

    public function __construct(protected UserPermissionService $userPermissions) {}

    /**
     * @param  list<string>  $before
     * @param  list<string>  $after
     * @return array{added: list<string>, removed: list<string>}
     */
    public function diff(array $before, array $after): array
    {
        return [
            'added' => array_values(array_diff($after, $before)),
            'removed' => array_values(array_diff($before, $after)),
        ];
    }

    /**
     * Usuarios que tienen el rol, con lo que ganaria o perderia cada uno si se le aplica.
     *
     * Sin ese detalle, elegir a quien propagar es a ciegas: dos personas con el mismo rol
     * pueden tener conjuntos muy distintos si alguien las ajusto por su cuenta.
     *
     * @param  list<string>  $added
     * @param  list<string>  $removed
     * @return list<array<string, mixed>>
     */
    public function usersForPropagation(Role $role, array $added = [], array $removed = []): array
    {
        $userIds = DB::table('model_has_roles')
            ->where('role_id', $role->id)
            ->where('model_type', (new User)->getMorphClass())
            ->pluck('model_id')
            ->all();

        if ($userIds === []) {
            return [];
        }

        return User::query()
            ->whereIn('id', $userIds)
            ->with('permissions:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'last_name', 'email', 'is_active', 'company_id'])
            ->map(function (User $user) use ($added, $removed) {
                $current = $user->permissions->pluck('name')->all();

                return [
                    'id' => $user->id,
                    'name' => trim($user->name.' '.($user->last_name ?? '')),
                    'email' => $user->email,
                    'is_active' => (bool) $user->is_active,
                    'permissions_count' => count($current),
                    // Solo lo que de verdad cambiaria para esta persona.
                    'will_gain' => count(array_diff($added, $current)),
                    'will_lose' => count(array_intersect($removed, $current)),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Aplica la diferencia a los usuarios elegidos.
     *
     * @param  list<int>  $userIds
     * @param  list<string>  $added
     * @param  list<string>  $removed
     * @return int usuarios afectados
     */
    public function propagate(Role $role, array $userIds, array $added, array $removed, User $actor): int
    {
        if ($userIds === [] || ($added === [] && $removed === [])) {
            return 0;
        }

        $eligible = DB::table('model_has_roles')
            ->where('role_id', $role->id)
            ->where('model_type', (new User)->getMorphClass())
            ->pluck('model_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        // Solo se propaga a quien tenga el rol: el id llega del cliente y no se confia en el.
        $targets = array_values(array_intersect(array_map('intval', $userIds), $eligible));

        if ($targets === []) {
            return 0;
        }

        $users = User::query()->whereIn('id', $targets)->get();
        $affected = 0;

        foreach ($users as $user) {
            if ($user->isSuperAdmin() || ! $user->company_id) {
                continue;
            }

            if (! $actor->isSuperAdmin() && (int) $actor->company_id !== (int) $user->company_id) {
                continue;
            }

            $this->userPermissions->applyDelta($user, $added, $removed);
            $affected++;
        }

        return $affected;
    }

    /**
     * Aplica la plantilla completa, reemplazando lo que cada usuario tuviera.
     *
     * @param  list<int>  $userIds
     * @return int usuarios afectados
     */
    public function applyTemplate(Role $role, array $userIds, User $actor): int
    {
        $role->loadMissing('permissions');
        $names = $role->permissions->pluck('name')->all();
        $affected = 0;

        foreach (User::query()->whereIn('id', array_map('intval', $userIds))->get() as $user) {
            if ($user->isSuperAdmin() || ! $user->company_id) {
                continue;
            }

            if (! $actor->isSuperAdmin() && (int) $actor->company_id !== (int) $user->company_id) {
                continue;
            }

            $this->userPermissions->sync($user, $names, $actor);
            $affected++;
        }

        return $affected;
    }
}
