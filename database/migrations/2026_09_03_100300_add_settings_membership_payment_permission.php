<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permiso para gestionar la tarjeta y el debito automatico de la membresia.
 *
 * No se hereda de `settings.index.edit` a proposito: quien entra a «Mi empresa» para tocar
 * deducciones o los umbrales de dificultad —un contador, por ejemplo— no tiene por que
 * poder cambiar la tarjeta con la que se cobra la empresa. Nace solo en el rol «admin» de
 * cada empresa, que es el propietario de la cuenta; el super admin lo tiene por definicion.
 *
 * Se escribe en la plantilla del rol y tambien en cada usuario que lo tenga, porque desde
 * que el rol es plantilla el permiso efectivo sale de `model_has_permissions`.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    protected const PERMISSION = 'settings.membership.manage_payment';

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

        $permissionId = DB::table('permissions')
            ->where('guard_name', 'web')
            ->where('name', self::PERMISSION)
            ->value('id');

        if ($permissionId === null) {
            return;
        }

        $adminRoleIds = DB::table('roles')
            ->where('guard_name', 'web')
            ->where('name', 'admin')
            ->pluck('id')
            ->all();

        if ($adminRoleIds === []) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return;
        }

        DB::table('role_has_permissions')->insertOrIgnore(
            array_map(fn ($roleId) => ['permission_id' => $permissionId, 'role_id' => $roleId], $adminRoleIds)
        );

        $adminUserIds = DB::table('model_has_roles')
            ->where('model_type', self::MODEL_TYPE)
            ->whereIn('role_id', $adminRoleIds)
            ->pluck('model_id')
            ->unique()
            ->all();

        foreach (array_chunk($adminUserIds, 500) as $chunk) {
            DB::table('model_has_permissions')->insertOrIgnore(
                array_map(fn ($userId) => [
                    'permission_id' => $permissionId,
                    'model_type' => self::MODEL_TYPE,
                    'model_id' => $userId,
                ], $chunk)
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', self::PERMISSION)->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table('role_has_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('model_has_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('permissions')->where('id', $permissionId)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
