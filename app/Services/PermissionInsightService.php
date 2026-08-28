<?php

namespace App\Services;

use App\Helpers\PermissionHelper;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Cuentas sobre permisos: cuantos tiene cada quien y en que se aparta de su plantilla.
 *
 * Vive en el servidor a proposito. Calcular «+3 extra / −1 quitado» recorriendo el catalogo
 * en el cliente obligaria a mandar los permisos de cada usuario y de cada rol solo para
 * pintar una pastilla del listado; ademas dos pantallas acabarian contando distinto.
 */
class PermissionInsightService
{
    /**
     * Permisos propios de varios usuarios, en una sola consulta.
     *
     * @param  list<int>  $userIds
     * @return array<int, list<string>>
     */
    public function assignedByUser(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return DB::table('model_has_permissions')
            ->join('permissions', 'model_has_permissions.permission_id', '=', 'permissions.id')
            ->where('model_has_permissions.model_type', (new User)->getMorphClass())
            ->whereIn('model_has_permissions.model_id', $userIds)
            ->get(['model_has_permissions.model_id as user_id', 'permissions.name as name'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->pluck('name')->values()->all())
            ->all();
    }

    /**
     * Permisos de la plantilla (el rol) de varios usuarios, en una sola consulta.
     *
     * @param  list<int>  $userIds
     * @return array<int, list<string>>
     */
    public function templateByUser(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return DB::table('model_has_roles')
            ->join('role_has_permissions', 'model_has_roles.role_id', '=', 'role_has_permissions.role_id')
            ->join('permissions', 'role_has_permissions.permission_id', '=', 'permissions.id')
            ->where('model_has_roles.model_type', (new User)->getMorphClass())
            ->whereIn('model_has_roles.model_id', $userIds)
            ->get(['model_has_roles.model_id as user_id', 'permissions.name as name'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->pluck('name')->unique()->values()->all())
            ->all();
    }

    /**
     * Resumen por usuario: cuantos permisos tiene, cuantos sobran respecto a su plantilla y
     * cuantos de la plantilla le fueron quitados.
     *
     * @param  Collection<int, User>|list<User>  $users
     * @return array<int, array{assigned: int, extra: int, missing: int, template: int}>
     */
    public function summaries(Collection|array $users): array
    {
        $users = $users instanceof Collection ? $users : collect($users);
        $ids = $users->pluck('id')->map(fn ($id) => (int) $id)->all();

        $assigned = $this->assignedByUser($ids);
        $template = $this->templateByUser($ids);
        $catalogueSize = count(PermissionHelper::flatPermissions());

        $out = [];

        foreach ($users as $user) {
            // El super admin no tiene filas: lo puede todo por definicion, y contar
            // «excepciones» sobre el seria inventar una diferencia que no existe.
            if ($user->isSuperAdmin()) {
                $out[$user->id] = [
                    'assigned' => $catalogueSize,
                    'extra' => 0,
                    'missing' => 0,
                    'template' => $catalogueSize,
                ];

                continue;
            }

            $own = $assigned[$user->id] ?? [];
            $base = $template[$user->id] ?? [];

            $out[$user->id] = [
                'assigned' => count($own),
                'extra' => count(array_diff($own, $base)),
                'missing' => count(array_diff($base, $own)),
                'template' => count($base),
            ];
        }

        return $out;
    }

    /**
     * @return array{assigned: int, extra: int, missing: int, template: int}
     */
    public function summaryFor(User $user): array
    {
        return $this->summaries([$user])[$user->id];
    }

    /**
     * Cobertura por modulo: cuanto del catalogo de cada modulo cubre un conjunto de permisos.
     *
     * @param  list<string>  $permissions
     * @param  list<string>  $template  plantilla contra la que comparar; vacia = sin comparacion
     * @return list<array<string, mixed>>
     */
    public function moduleCoverage(array $permissions, array $template = []): array
    {
        $own = array_flip($permissions);
        $base = array_flip($template);
        $rows = [];

        foreach (PermissionHelper::catalogue(true) as $module) {
            $names = [];
            foreach ($module['groups'] as $group) {
                foreach ($group['permissions'] as $permission) {
                    $names[] = $permission['name'];
                }
            }

            $count = 0;
            $extra = 0;
            $missing = 0;

            foreach ($names as $name) {
                $hasOwn = isset($own[$name]);
                $inTemplate = isset($base[$name]);

                if ($hasOwn) {
                    $count++;
                }
                if ($template !== [] && $hasOwn && ! $inTemplate) {
                    $extra++;
                }
                if ($template !== [] && ! $hasOwn && $inTemplate) {
                    $missing++;
                }
            }

            $rows[] = [
                'module' => $module['key'],
                'display' => $module['display'],
                'count' => $count,
                'total' => count($names),
                'extra' => $extra,
                'missing' => $missing,
                'super_admin_only' => $module['super_admin_only'],
            ];
        }

        return $rows;
    }

    /**
     * Claves de los modulos donde el rol tiene al menos un permiso, para las pastillas de area.
     *
     * @param  list<string>  $permissions
     * @return list<array{key: string, display: string}>
     */
    public function touchedModules(array $permissions): array
    {
        return collect($this->moduleCoverage($permissions))
            ->filter(fn ($row) => $row['count'] > 0)
            ->map(fn ($row) => ['key' => $row['module'], 'display' => $row['display']])
            ->values()
            ->all();
    }

    /**
     * Cuantos usuarios tienen permisos que no coinciden con su plantilla.
     *
     * @param  Collection<int, User>|list<User>  $users
     */
    public function countWithOverrides(Collection|array $users): int
    {
        return collect($this->summaries($users))
            ->filter(fn ($row) => $row['extra'] > 0 || $row['missing'] > 0)
            ->count();
    }

    /**
     * Hasta `$limit` usuarios de un rol, con lo justo para la pila de avatares.
     *
     * @return list<array<string, mixed>>
     */
    public function avatarsForRole(Role $role, int $limit = 3): array
    {
        return User::query()
            ->whereIn('id', DB::table('model_has_roles')
                ->where('role_id', $role->id)
                ->where('model_type', (new User)->getMorphClass())
                ->pluck('model_id'))
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'last_name', 'avatar'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => trim($user->name.' '.($user->last_name ?? '')),
                'initials' => $user->initials,
                'avatar' => $user->avatar,
            ])
            ->values()
            ->all();
    }
}
