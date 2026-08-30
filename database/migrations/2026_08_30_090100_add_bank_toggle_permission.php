<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Permiso del interruptor de estado del listado de Bancos.
 *
 * El interruptor de la tabla llama a una ruta propia, no a `banks.update`, asi que sin
 * permiso suyo quedaria cubierto por `banks.index.edit` sin poder separarse. Se sigue lo
 * que ya hacen `payroll_concepts` y `expenses.categories`.
 *
 * Como en las migraciones de permisos anteriores, el permiso nuevo se concede a quien ya
 * tenia el que hasta hoy lo cubria: nadie pierde nada al desplegar.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    /** permiso nuevo => permiso que hasta hoy lo cubria. */
    protected const INHERITS_FROM = [
        'banks.index.toggle' => 'banks.index.edit',
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
        $ids = DB::table('permissions')
            ->whereIn('name', array_keys(self::INHERITS_FROM))
            ->pluck('id')
            ->all();

        if ($ids === []) {
            return;
        }

        DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
