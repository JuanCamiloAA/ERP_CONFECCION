<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permiso para ver la franja de totales de una nomina.
 *
 * Hasta hoy `payrolls.show.view` abria el detalle Y la franja con el producido, las
 * deducciones y el neto de toda la empresa. Al empleado que entra a mirar su liquidacion
 * —y a quien le llega el aviso de cierre— eso le sobra: lo suyo es su propio devengado.
 *
 * Por eso el permiso nuevo NO se hereda de `payrolls.show.view`, que es justo el que
 * tienen los operarios: se hereda de `payrolls.show.calculate`, porque quien liquida el
 * periodo si necesita cuadrar el agregado. Los roles que administran o consultan la
 * nomina sin calcularla lo reciben por concesion explicita.
 *
 * Se concede a roles Y a usuarios: desde que el rol es solo una plantilla, lo que decide
 * en tiempo de ejecucion es `model_has_permissions`.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    protected const PERMISSION = 'payrolls.show.view_totals';

    /** permiso nuevo => permiso que hasta hoy lo cubria. */
    protected const INHERITS_FROM = [
        self::PERMISSION => 'payrolls.show.calculate',
    ];

    /** rol de empresa => permisos que recibe aunque no los herede de nada. */
    protected const ROLE_GRANTS = [
        'admin' => [self::PERMISSION],
        'auxiliar_contable' => [self::PERMISSION],
        // Solo Consulta ya ve la liquidacion de cada empleado del periodo: esconderle la
        // suma no protegeria nada y dejaria la pantalla a medias.
        'solo_consulta' => [self::PERMISSION],
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

        // El super admin lo tiene todo por `before()` en las policies, pero la fila es la
        // que hace que la matriz de roles lo muestre marcado.
        $superAdminId = DB::table('roles')
            ->where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->value('id');

        if ($superAdminId && isset($ids[self::PERMISSION])) {
            $roleRows[] = ['permission_id' => $ids[self::PERMISSION], 'role_id' => $superAdminId];
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
        $ids = DB::table('permissions')->where('name', self::PERMISSION)->pluck('id')->all();

        if ($ids === []) {
            return;
        }

        DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
