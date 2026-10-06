<?php

namespace App\Services;

use App\Helpers\PermissionHelper;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permisos propios de un usuario.
 *
 * Desde que el rol es una plantilla, este servicio es el unico sitio que escribe lo que
 * puede hacer una persona. Todo pasa por el catalogo de `PermissionHelper`: un permiso que
 * no este catalogado no se guarda, para que no queden filas que ninguna pantalla sabe
 * mostrar ni ninguna ruta comprueba.
 */
class UserPermissionService
{
    public function __construct(protected PermissionRegistrar $permissionRegistrar) {}

    /**
     * @return list<string>
     */
    public function namesFor(User $user): array
    {
        return $user->permissions()->orderBy('name')->pluck('name')->unique()->values()->all();
    }

    /**
     * Reemplaza el conjunto completo del usuario.
     *
     * @param  list<string>  $permissionNames
     */
    public function sync(User $target, array $permissionNames, User $actor): void
    {
        $this->assertEditable($target);
        $this->assertSameCompany($actor, $target);

        $this->replaceAll($target, $permissionNames);
    }

    /**
     * Permisos con que nace un usuario: los de la plantilla de su rol.
     *
     * Desde que el rol es solo una plantilla, lo que un usuario puede hacer sale de
     * `model_has_permissions`, no de su rol: asignarle el rol sin copiar la plantilla lo
     * dejaba entrando sin poder abrir nada. Despues cada usuario se ajusta por su cuenta.
     *
     * El super admin no lleva permisos uno a uno, y un usuario sin empresa no tiene donde
     * aplicarlos: en esos casos no hace nada.
     */
    public function initializeFromRole(User $target, ?Role $role): void
    {
        if (! $role || $role->name === 'super_admin' || ! $target->company_id) {
            return;
        }

        // Se relee el rol: quien llama acaba de asignarlo y la relacion puede venir vieja.
        if ($target->load('roles')->isSuperAdmin()) {
            return;
        }

        $this->replaceAll($target, $role->permissions()->pluck('name')->all());
    }

    /**
     * Cambio de rol: entra lo que el rol nuevo tiene y el anterior no, y sale lo que el
     * anterior tenia y el nuevo no. Las excepciones de la persona —lo que se le dio o se le
     * quito a mano— no se tocan: «cambiar su rol no borra estas excepciones».
     */
    public function switchRole(User $target, ?Role $previous, Role $next): void
    {
        if ($next->name === 'super_admin' || ! $target->company_id || $target->load('roles')->isSuperAdmin()) {
            return;
        }

        if ($previous !== null && (int) $previous->getKey() === (int) $next->getKey()) {
            return;
        }

        // Venia de super admin: no tenia permisos uno a uno, asi que arranca de la plantilla.
        if ($previous !== null && $previous->name === 'super_admin') {
            $this->initializeFromRole($target, $next);

            return;
        }

        $old = $previous ? $previous->permissions()->pluck('name')->all() : [];
        $new = $next->permissions()->pluck('name')->all();

        $this->applyDelta($target, array_values(array_diff($new, $old)), array_values(array_diff($old, $new)));
    }

    /**
     * @param  list<string>  $permissionNames
     */
    protected function replaceAll(User $target, array $permissionNames): void
    {
        $ids = $this->resolveIds($permissionNames);

        DB::transaction(function () use ($target, $ids): void {
            DB::table('model_has_permissions')
                ->where('model_type', $target->getMorphClass())
                ->where('model_id', $target->getKey())
                ->delete();

            if ($ids === []) {
                return;
            }

            DB::table('model_has_permissions')->insertOrIgnore(
                array_map(fn (int $id) => [
                    'permission_id' => $id,
                    'model_type' => $target->getMorphClass(),
                    'model_id' => $target->getKey(),
                ], $ids)
            );
        });

        $this->flush($target);
    }

    /**
     * Aplica una plantilla de rol al usuario, reemplazando lo que tuviera.
     */
    public function applyRoleTemplate(User $target, Role $role, User $actor): void
    {
        $this->sync($target, $role->permissions->pluck('name')->all(), $actor);
    }

    /**
     * Suma y resta permisos sin tocar el resto.
     *
     * Es lo que usa la propagacion de un rol: al cambiar la plantilla se aplica solo la
     * diferencia, para no borrar los ajustes que cada usuario tuviera por su cuenta.
     *
     * @param  list<string>  $add
     * @param  list<string>  $remove
     */
    public function applyDelta(User $target, array $add, array $remove): void
    {
        $this->assertEditable($target);

        $addIds = $this->resolveIds($add);
        $removeIds = $this->resolveIds($remove);

        DB::transaction(function () use ($target, $addIds, $removeIds): void {
            if ($removeIds !== []) {
                DB::table('model_has_permissions')
                    ->where('model_type', $target->getMorphClass())
                    ->where('model_id', $target->getKey())
                    ->whereIn('permission_id', $removeIds)
                    ->delete();
            }

            if ($addIds !== []) {
                DB::table('model_has_permissions')->insertOrIgnore(
                    array_map(fn (int $id) => [
                        'permission_id' => $id,
                        'model_type' => $target->getMorphClass(),
                        'model_id' => $target->getKey(),
                    ], $addIds)
                );
            }
        });

        $this->flush($target);
    }

    /**
     * Ids de los permisos catalogados; lo que no este en el catalogo se descarta en silencio.
     *
     * @param  list<string>  $names
     * @return list<int>
     */
    protected function resolveIds(array $names): array
    {
        $valid = array_values(array_unique(array_filter(
            array_map('strval', $names),
            fn (string $name) => $name !== '' && PermissionHelper::permissionExists($name),
        )));

        if ($valid === []) {
            return [];
        }

        return Permission::query()
            ->whereIn('name', $valid)
            ->where('guard_name', 'web')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    protected function assertEditable(User $target): void
    {
        if ($target->isSuperAdmin()) {
            throw new \InvalidArgumentException('El super administrador siempre tiene todos los permisos; no se le asignan uno a uno.');
        }

        if (! $target->company_id) {
            throw new \InvalidArgumentException('El usuario debe pertenecer a una empresa.');
        }
    }

    protected function assertSameCompany(User $actor, User $target): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }

        if ((int) $actor->company_id !== (int) $target->company_id) {
            throw new \InvalidArgumentException('No puedes modificar permisos de usuarios de otra empresa.');
        }
    }

    protected function flush(User $user): void
    {
        $this->permissionRegistrar->forgetCachedPermissions();
        $user->unsetRelation('permissions');
        $user->flushEffectivePermissionCache();
    }
}
