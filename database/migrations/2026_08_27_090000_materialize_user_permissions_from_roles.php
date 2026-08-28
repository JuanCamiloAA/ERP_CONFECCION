<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * El rol pasa a ser una plantilla: deja de conceder permisos en tiempo de ejecucion.
 *
 * Hasta ahora el permiso efectivo de un usuario se calculaba como «permisos del rol menos
 * las denegaciones mas las concesiones». Eso hacia imposible responder «que puede hacer
 * exactamente esta persona» sin reconstruir la cuenta, y cualquier retoque a un rol se
 * propagaba en silencio a todo el que lo tuviera.
 *
 * A partir de aqui cada usuario guarda su propio conjunto de permisos (`model_has_permissions`)
 * y el rol solo sirve para partir de una plantilla. Esta migracion congela lo que cada
 * usuario podia hacer justo antes del cambio, para que nadie gane ni pierda accesos el dia
 * del despliegue.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    public function up(): void
    {
        $superAdminRoleIds = DB::table('roles')->where('name', 'super_admin')->pluck('id')->all();

        $rolesByUser = DB::table('model_has_roles')
            ->where('model_type', self::MODEL_TYPE)
            ->get(['model_id', 'role_id'])
            ->groupBy('model_id');

        $permissionsByRole = DB::table('role_has_permissions')
            ->get(['role_id', 'permission_id'])
            ->groupBy('role_id')
            ->map(fn ($rows) => $rows->pluck('permission_id')->all());

        $overridesByUser = DB::table('user_permission_overrides')
            ->get(['user_id', 'permission_id', 'effect'])
            ->groupBy('user_id');

        $directByUser = DB::table('model_has_permissions')
            ->where('model_type', self::MODEL_TYPE)
            ->get(['model_id', 'permission_id'])
            ->groupBy('model_id')
            ->map(fn ($rows) => $rows->pluck('permission_id')->all());

        $rows = [];

        DB::table('users')->orderBy('id')->select('id')->chunk(500, function ($users) use (
            $superAdminRoleIds,
            $rolesByUser,
            $permissionsByRole,
            $overridesByUser,
            $directByUser,
            &$rows
        ) {
            foreach ($users as $user) {
                $roleIds = ($rolesByUser[$user->id] ?? collect())->pluck('role_id')->all();

                // El super admin no necesita filas: `User::hasPermissionTo()` lo resuelve antes
                // de consultar nada, y materializarle 100 permisos solo estorba al leer la tabla.
                if (array_intersect($roleIds, $superAdminRoleIds) !== []) {
                    continue;
                }

                $effective = [];
                foreach ($roleIds as $roleId) {
                    foreach ($permissionsByRole[$roleId] ?? [] as $permissionId) {
                        $effective[$permissionId] = true;
                    }
                }

                foreach ($directByUser[$user->id] ?? [] as $permissionId) {
                    $effective[$permissionId] = true;
                }

                foreach ($overridesByUser[$user->id] ?? [] as $override) {
                    if ($override->effect === 'grant') {
                        $effective[$override->permission_id] = true;
                    } else {
                        unset($effective[$override->permission_id]);
                    }
                }

                $alreadyDirect = array_flip($directByUser[$user->id] ?? []);

                foreach (array_keys($effective) as $permissionId) {
                    if (isset($alreadyDirect[$permissionId])) {
                        continue;
                    }

                    $rows[] = [
                        'permission_id' => $permissionId,
                        'model_type' => self::MODEL_TYPE,
                        'model_id' => $user->id,
                    ];
                }
            }
        });

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('model_has_permissions')->insertOrIgnore($chunk);
        }
    }

    /**
     * Sin vuelta atras a proposito.
     *
     * Una vez materializados, no hay forma de distinguir las filas que creo esta migracion
     * de las que un administrador asigno despues a mano. Borrarlas todas dejaria sin
     * permisos a quien los tuviera solo por asignacion directa, que es justo lo que este
     * cambio hace normal. Para revertir de verdad hay que restaurar un respaldo.
     */
    public function down(): void
    {
        //
    }
};
