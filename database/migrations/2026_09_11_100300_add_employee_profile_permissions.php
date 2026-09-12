<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permisos de la ficha 360 para los roles y usuarios que ya existen.
 *
 * Dos mecanismos, porque resuelven cosas distintas:
 *
 * 1. Herencia: quien ya podia editar un empleado (`employees.index.edit`) veia su salario
 *    y su cuenta en la ficha vieja, asi que recibe los permisos nuevos equivalentes. Sin
 *    esto, el dia del despliegue el administrador de cada empresa veria «Restringido» en
 *    su propia ficha hasta volver a aplicar la plantilla del rol.
 *
 * 2. Concesiones por rol: el auxiliar contable liquida nomina y anticipos —necesita ver
 *    el dinero y aprobar solicitudes— pero nunca tuvo `employees.index.edit`; y el
 *    supervisor de produccion aprueba las correcciones de su modulo sin ver salarios.
 *    Esas dos formas no se deducen de ningun permiso anterior: se conceden aqui.
 *
 * Como en el resto del modulo, el permiso se da a roles Y a usuarios: desde que el rol es
 * solo una plantilla, lo que decide en tiempo de ejecucion es `model_has_permissions`.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    /** permiso nuevo => permiso que hasta hoy lo cubria. */
    protected const INHERITS_FROM = [
        'employees.profile.view_salary' => 'employees.index.edit',
        'employees.profile.view_bank_account' => 'employees.index.edit',
        'employees.profile.edit_section' => 'employees.index.edit',
        'employees.profile.view_audit' => 'employees.index.edit',
        'employees.profile.manage_lifecycle' => 'employees.index.edit',
        'employees.requests.approve' => 'employees.index.edit',
        'employees.requests.view' => 'employees.show.view',
    ];

    /** rol de empresa => permisos que recibe aunque no los herede de nada. */
    protected const ROLE_GRANTS = [
        'auxiliar_contable' => [
            'employees.profile.view_salary',
            'employees.profile.view_bank_account',
            'employees.requests.view',
            'employees.requests.approve',
        ],
        'supervisor_produccion' => [
            'employees.requests.view',
            'employees.requests.approve',
        ],
    ];

    public function up(): void
    {
        $now = now();

        $existing = DB::table('permissions')->where('guard_name', 'web')->pluck('name')->all();
        $missing = array_values(array_diff(PermissionHelper::flatPermissions(), $existing));

        if ($missing !== []) {
            DB::table('permissions')->insertOrIgnore(array_map(fn (string $name) => [
                'name' => $name,
                'guard_name' => 'web',
                'created_at' => $now,
                'updated_at' => $now,
            ], $missing));
        }

        $ids = DB::table('permissions')->where('guard_name', 'web')->pluck('id', 'name');

        $roleRows = [];
        $userRows = [];

        foreach (self::INHERITS_FROM as $new => $source) {
            $newId = $ids[$new] ?? null;
            $sourceId = $ids[$source] ?? null;

            if ($newId === null || $sourceId === null) {
                continue;
            }

            foreach (DB::table('role_has_permissions')->where('permission_id', $sourceId)->pluck('role_id') as $roleId) {
                $roleRows[] = ['permission_id' => $newId, 'role_id' => $roleId];
            }

            $holders = DB::table('model_has_permissions')
                ->where('permission_id', $sourceId)
                ->where('model_type', self::MODEL_TYPE)
                ->pluck('model_id');

            foreach ($holders as $modelId) {
                $userRows[] = [
                    'permission_id' => $newId,
                    'model_type' => self::MODEL_TYPE,
                    'model_id' => $modelId,
                ];
            }
        }

        foreach (self::ROLE_GRANTS as $roleName => $permissions) {
            $roleIds = DB::table('roles')
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->whereNotNull('company_id')
                ->pluck('id');

            if ($roleIds->isEmpty()) {
                continue;
            }

            // Los usuarios que llevan ese rol tambien reciben el permiso directo: el rol
            // por si solo no habilita nada desde que la plantilla se materializa por usuario.
            $userIds = DB::table('model_has_roles')
                ->whereIn('role_id', $roleIds)
                ->where('model_type', self::MODEL_TYPE)
                ->pluck('model_id');

            foreach ($permissions as $name) {
                $permissionId = $ids[$name] ?? null;
                if ($permissionId === null) {
                    continue;
                }

                foreach ($roleIds as $roleId) {
                    $roleRows[] = ['permission_id' => $permissionId, 'role_id' => $roleId];
                }

                foreach ($userIds as $userId) {
                    $userRows[] = [
                        'permission_id' => $permissionId,
                        'model_type' => self::MODEL_TYPE,
                        'model_id' => $userId,
                    ];
                }
            }
        }

        // El super admin lo tiene todo por `before()` en las policies, pero la fila en
        // `role_has_permissions` es la que hace que la matriz de roles lo muestre marcado.
        $superAdminId = DB::table('roles')
            ->where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->value('id');

        if ($superAdminId) {
            foreach (array_keys(self::INHERITS_FROM) as $name) {
                if (isset($ids[$name])) {
                    $roleRows[] = ['permission_id' => $ids[$name], 'role_id' => $superAdminId];
                }
            }
        }

        foreach (array_chunk($roleRows, 500) as $chunk) {
            DB::table('role_has_permissions')->insertOrIgnore($chunk);
        }

        foreach (array_chunk($userRows, 500) as $chunk) {
            DB::table('model_has_permissions')->insertOrIgnore($chunk);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $names = array_unique(array_merge(
            array_keys(self::INHERITS_FROM),
            ...array_values(self::ROLE_GRANTS),
        ));

        $ids = DB::table('permissions')->whereIn('name', $names)->pluck('id')->all();

        if ($ids === []) {
            return;
        }

        DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
