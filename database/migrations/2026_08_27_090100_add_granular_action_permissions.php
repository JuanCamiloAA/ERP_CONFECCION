<?php

use App\Helpers\PermissionHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Un permiso por accion real.
 *
 * Hasta ahora casi todos los modulos exigian un solo `*.index.view` para todo su grupo de
 * rutas: quien veia los anticipos podia exportarlos y borrarlos aunque la interfaz le
 * escondiera los botones. Al empezar a exigir el permiso fino en cada ruta, quien pudiera
 * hacer algo el dia anterior se quedaria fuera; por eso cada permiso nuevo se concede a
 * quien ya tenia el que hasta hoy lo cubria.
 *
 * La herencia se declara explicita, permiso a permiso, para que se pueda revisar y para que
 * quede escrito de donde salio cada concesion.
 */
return new class extends Migration
{
    protected const MODEL_TYPE = 'App\Models\User';

    /** permiso nuevo => permiso que hasta hoy lo cubria. */
    protected const INHERITS_FROM = [
        'dashboard.index.customize' => 'dashboard.index.view',

        'employees.index.deactivate' => 'employees.index.edit',
        'employees.index.reactivate' => 'employees.index.edit',
        'employees.access.create' => 'employees.index.edit',
        'employees.access.reset_password' => 'employees.index.edit',
        'employees.access.change_role' => 'employees.index.edit',
        'employees.access.toggle' => 'employees.index.edit',

        'references.index.duplicate' => 'references.index.create',
        'references.index.export_excel' => 'references.index.view',
        'references.index.export_pdf' => 'references.index.view',
        'references.index.recalculate_difficulty' => 'references.index.edit',
        'references.operations.attach' => 'references.index.edit',
        'references.operations.update' => 'references.index.edit',
        'references.operations.detach' => 'references.index.edit',
        'references.operations.recalculate' => 'references.index.edit',

        'operations.index.duplicate' => 'operations.index.create',
        'operations.index.bulk_status' => 'operations.index.edit',
        'operations.index.edit_price' => 'operations.index.edit',
        'operations.show.view' => 'operations.index.view',

        'productions.index.confirm' => 'productions.index.edit',
        'productions.index.confirm_day' => 'productions.index.edit',

        'payrolls.employee.view' => 'payrolls.show.view',
        'payrolls.employee.receipt' => 'payrolls.show.export',

        'payroll_concepts.index.reorder' => 'payroll_concepts.index.edit',
        'payroll_concepts.index.toggle' => 'payroll_concepts.index.edit',

        'advances.index.export' => 'advances.index.view',
        'advances.show.view' => 'advances.index.view',
        'advances.show.receipt' => 'advances.index.view',

        'expenses.index.export' => 'expenses.index.view',
        'expenses.index.quick_create' => 'expenses.index.create',
        'expenses.show.view' => 'expenses.index.view',
        'expenses.categories.reorder' => 'expenses.categories.edit',
        'expenses.categories.toggle' => 'expenses.categories.edit',

        'users.show.view' => 'users.index.view',

        'roles.index.propagate' => 'roles.index.edit',
    ];

    public function up(): void
    {
        $now = now();

        // 1. Crear los permisos que falten del catalogo.
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

        // 2. Heredar: quien tuviera el permiso de origen recibe el nuevo.
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
