<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Los permisos nuevos deben existir en `permissions` y enlazarse a roles;
 * sin esto, el menu (accessible_pages) y `can('payrolls.show.manage_adjustments')` fallan si no se re-ejecuto el seeder completo.
 */
return new class extends Migration
{
    protected array $adminPermissions = [
        'payroll_concepts.index.view',
        'payroll_concepts.index.create',
        'payroll_concepts.index.edit',
        'payroll_concepts.index.delete',
        'payrolls.show.manage_adjustments',
    ];

    protected array $accountantPermissions = [
        'payroll_concepts.index.view',
        'payroll_concepts.index.create',
        'payroll_concepts.index.edit',
        'payrolls.show.manage_adjustments',
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($this->adminPermissions as $name) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => 'web'],
            );
        }

        $superAdmin = Role::query()
            ->where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->first();

        if ($superAdmin) {
            foreach ($this->adminPermissions as $name) {
                $permission = Permission::query()->where('name', $name)->where('guard_name', 'web')->first();
                if ($permission && ! $superAdmin->hasPermissionTo($permission)) {
                    $superAdmin->givePermissionTo($permission);
                }
            }
        }

        Role::query()
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->whereNotNull('company_id')
            ->each(function (Role $role): void {
                foreach ($this->adminPermissions as $name) {
                    $permission = Permission::query()->where('name', $name)->where('guard_name', 'web')->first();
                    if ($permission && ! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                }
            });

        Role::query()
            ->where('name', 'auxiliar_contable')
            ->where('guard_name', 'web')
            ->whereNotNull('company_id')
            ->each(function (Role $role): void {
                foreach ($this->accountantPermissions as $name) {
                    $permission = Permission::query()->where('name', $name)->where('guard_name', 'web')->first();
                    if ($permission && ! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                }
            });

        Role::query()
            ->where('name', 'supervisor_produccion')
            ->where('guard_name', 'web')
            ->whereNotNull('company_id')
            ->each(function (Role $role): void {
                foreach ($this->accountantPermissions as $name) {
                    $permission = Permission::query()->where('name', $name)->where('guard_name', 'web')->first();
                    if ($permission && ! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                }
            });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
