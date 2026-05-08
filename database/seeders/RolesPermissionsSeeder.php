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
}
