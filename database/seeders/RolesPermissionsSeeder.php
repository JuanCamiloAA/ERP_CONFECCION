<?php

namespace Database\Seeders;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\Role;
use App\Services\CompanyDefaultRolesService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->seedPermissions();
        $this->seedSystemRoles();
        $this->seedDemoCompanyRoles();
        $this->grantUserOverridePermissionToCompanyAdmins();
        $this->grantPayrollConceptsModuleToCompanyRoles();
    }

    /**
     * Asegura que cada rol administrador de empresa tenga el permiso de excepciones por usuario.
     * Sin esto, el rol admin queda sin el permiso nuevo si la BD se creo antes de anadirlo a la matriz.
     */
    protected function grantUserOverridePermissionToCompanyAdmins(): void
    {
        $name = 'users.edit.permission_overrides';

        if (! PermissionHelper::permissionExists($name)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => $name, 'guard_name' => 'web'],
        );

        Role::query()
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->whereNotNull('company_id')
            ->each(function (Role $role) use ($permission): void {
                if (! $role->hasPermissionTo($permission)) {
                    $role->givePermissionTo($permission);
                }
            });
    }

    protected function seedPermissions(): void
    {
        foreach (PermissionHelper::flatPermissions() as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }
    }

    protected function seedSystemRoles(): void
    {
        $superAdmin = Role::firstOrCreate(
            [
                'name' => 'super_admin',
                'guard_name' => 'web',
                'company_id' => null,
            ],
            [
                'display_name' => 'Super Administrador',
                'description' => 'Acceso total al sistema y todas las empresas.',
                'color' => '#dc2626',
                'is_system' => true,
            ]
        );
        $superAdmin->syncPermissions(Permission::all());
    }

    protected function seedDemoCompanyRoles(): void
    {
        $service = app(CompanyDefaultRolesService::class);

        Company::query()->orderBy('id')->each(function (Company $company) use ($service): void {
            $service->ensureDefaultRolesForCompany($company, false);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Permisos del catalogo de conceptos y ajustes en nomina: sin esto los roles existentes no los reciben hasta re-sincronizar desde la matriz.
     */
    protected function grantPayrollConceptsModuleToCompanyRoles(): void
    {
        $adminPermissions = [
            'payroll_concepts.index.view',
            'payroll_concepts.index.create',
            'payroll_concepts.index.edit',
            'payroll_concepts.index.delete',
            'payrolls.show.manage_adjustments',
        ];

        $accountantPermissions = [
            'payroll_concepts.index.view',
            'payroll_concepts.index.create',
            'payroll_concepts.index.edit',
            'payrolls.show.manage_adjustments',
        ];

        foreach ($adminPermissions as $name) {
            if (! PermissionHelper::permissionExists($name)) {
                continue;
            }
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            Role::query()
                ->where('name', 'admin')
                ->where('guard_name', 'web')
                ->whereNotNull('company_id')
                ->each(function (Role $role) use ($permission): void {
                    if (! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                });
        }

        foreach ($accountantPermissions as $name) {
            if (! PermissionHelper::permissionExists($name)) {
                continue;
            }
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            Role::query()
                ->where('name', 'auxiliar_contable')
                ->where('guard_name', 'web')
                ->whereNotNull('company_id')
                ->each(function (Role $role) use ($permission): void {
                    if (! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                });
        }

        foreach ($accountantPermissions as $name) {
            if (! PermissionHelper::permissionExists($name)) {
                continue;
            }
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            Role::query()
                ->where('name', 'supervisor_produccion')
                ->where('guard_name', 'web')
                ->whereNotNull('company_id')
                ->each(function (Role $role) use ($permission): void {
                    if (! $role->hasPermissionTo($permission)) {
                        $role->givePermissionTo($permission);
                    }
                });
        }

        $superAdmin = Role::query()
            ->where('name', 'super_admin')
            ->where('guard_name', 'web')
            ->whereNull('company_id')
            ->first();

        if ($superAdmin) {
            $superAdmin->syncPermissions(Permission::all());
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
