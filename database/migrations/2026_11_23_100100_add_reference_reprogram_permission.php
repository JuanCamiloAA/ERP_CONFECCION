<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permiso para reprogramar una referencia (`references.index.reprogram`).
 *
 * Se hereda de `references.index.edit`: hasta hoy, quien podia editar la referencia ya
 * podia cambiar su lote, su valor y los precios de sus operaciones, que es justo lo que
 * hace reprogramar. Quitarselo ahora seria retirar algo que nadie pidio retirar.
 *
 * Se concede a roles Y a usuarios: desde que el rol es solo una plantilla, lo que decide
 * en tiempo de ejecucion es `model_has_permissions`.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    protected const PERMISSIONS = ['references.index.reprogram'];

    protected const SOURCE = 'references.index.edit';

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
        $sourceId = $ids[self::SOURCE] ?? null;

        $roleIds = $sourceId === null
            ? collect()
            : DB::table('role_has_permissions')->where('permission_id', $sourceId)->pluck('role_id');

        $userIds = $sourceId === null
            ? collect()
            : DB::table('model_has_permissions')
                ->where('permission_id', $sourceId)
                ->where('model_type', self::MODEL_TYPE)
                ->pluck('model_id');

        // El super admin lo tiene todo por `before()` en las policies, pero la fila es la
        // que hace que la matriz de roles lo muestre marcado.
        $superAdminId = DB::table('roles')
            ->where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->value('id');

        if ($superAdminId) {
            $roleIds->push($superAdminId);
        }

        $roleRows = [];
        $userRows = [];

        foreach (self::PERMISSIONS as $name) {
            $permissionId = $ids[$name] ?? null;

            if ($permissionId === null) {
                continue;
            }

            foreach ($roleIds->unique() as $roleId) {
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
        $ids = DB::table('permissions')->whereIn('name', self::PERMISSIONS)->pluck('id')->all();

        if ($ids === []) {
            return;
        }

        DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
