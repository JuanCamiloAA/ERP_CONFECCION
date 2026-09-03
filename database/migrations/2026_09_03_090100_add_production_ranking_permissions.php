<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permisos nuevos del ranking de produccion.
 *
 * Hasta hoy `productions.ranking.view` lo cubria todo: quien entraba podia mirar los
 * agregados de la empresa y, con el filtro de equipo, cambiar lo que ven los demas. Se
 * separan cuatro acciones.
 *
 * Solo una se hereda: ajustar el filtro propio, que es lo que ya podia hacer cualquiera
 * que abriera la pantalla; quitarsela ahora dejaria la pantalla congelada sin que nadie lo
 * hubiera pedido. Las otras tres nacen apagadas —fijar el filtro del equipo se le ve a
 * todo el mundo, y exportar y ver agregados son datos de la empresa entera— y se conceden
 * unicamente a los roles «admin» de cada empresa, que es donde el catalogo las pone por
 * defecto. El super admin las tiene por definicion, sin fila que insertar.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    /** permiso nuevo => permiso que hasta hoy lo cubria. */
    protected const INHERITS_FROM = [
        'productions.ranking.filter_own.manage' => 'productions.ranking.view',
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

        // Las tres restrictivas: solo el rol «admin» de cada empresa las estrena. Se
        // escriben en la plantilla del rol y tambien en cada usuario que lo tenga, porque
        // desde que el rol es plantilla el permiso efectivo sale de `model_has_permissions`.
        $adminRoleIds = DB::table('roles')
            ->where('guard_name', 'web')
            ->where('name', 'admin')
            ->pluck('id')
            ->all();

        $adminUserIds = $adminRoleIds === []
            ? []
            : DB::table('model_has_roles')
                ->where('model_type', self::MODEL_TYPE)
                ->whereIn('role_id', $adminRoleIds)
                ->pluck('model_id')
                ->unique()
                ->all();

        foreach (PermissionHelper::RANKING_MANAGED_PERMISSIONS as $name) {
            $permissionId = $ids[$name] ?? null;

            if ($permissionId === null) {
                continue;
            }

            foreach ($adminRoleIds as $roleId) {
                $roleRows[] = ['permission_id' => $permissionId, 'role_id' => $roleId];
            }

            foreach ($adminUserIds as $userId) {
                $userRows[] = [
                    'permission_id' => $permissionId,
                    'model_type' => self::MODEL_TYPE,
                    'model_id' => $userId,
                ];
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
        $names = array_merge(array_keys(self::INHERITS_FROM), PermissionHelper::RANKING_MANAGED_PERMISSIONS);

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
