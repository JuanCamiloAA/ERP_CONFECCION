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
        $this->grantProductionsRankingPermissionToCompanyRoles();
        $this->grantHourlyLegalModulePermissionsToCompanyRoles();
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

    /**
     * Permisos que no siguen el patron modulo.pagina.accion de la matriz.
     *  protege el editor de la landing publica.
     *
     * @var list<string>
     */
    protected const STANDALONE_PERMISSIONS = ['landing.manage'];

    protected function seedPermissions(): void
    {
        foreach (self::STANDALONE_PERMISSIONS as $standalone) {
            Permission::firstOrCreate(['name' => $standalone, 'guard_name' => 'web']);
        }

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

    /**
     * Otorga el permiso del nuevo ranking de produccion a los roles por defecto de empresas ya existentes.
     * Usa givePermissionTo (aditivo) en vez de syncPermissions para no perder permisos personalizados por el admin de cada empresa.
     */
    protected function grantProductionsRankingPermissionToCompanyRoles(): void
    {
        $name = 'productions.ranking.view';

        if (! PermissionHelper::permissionExists($name)) {
            return;
        }

        $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);

        Role::query()
            ->whereIn('name', ['admin', 'supervisor_produccion', 'operario_produccion', 'solo_consulta'])
            ->where('guard_name', 'web')
            ->whereNotNull('company_id')
            ->each(function (Role $role) use ($permission): void {
                if (! $role->hasPermissionTo($permission)) {
                    $role->givePermissionTo($permission);
                }
            });

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

    /**
     * Modulo nuevo "hourly_legal" (jornada/recargos/horas extra + festivos, §4.6 del prompt de
     * nomina legal): el admin de empresa gestiona sus propios parametros legales; contable y
     * solo-consulta solo los ven (para saber que reglas rigen la liquidacion, sin poder cambiarlas).
     * Aditivo (givePermissionTo), no sync, para no perder personalizaciones de cada empresa.
     */
    protected function grantHourlyLegalModulePermissionsToCompanyRoles(): void
    {
        $adminPermissions = [
            'payroll_legal_parameters.index.view',
            'payroll_legal_parameters.index.create',
            'payroll_legal_parameters.index.edit',
            'payroll_legal_parameters.index.delete',
            'holidays.index.view',
            'holidays.index.create',
            'holidays.index.delete',
            'holidays.index.sync',
        ];

        $viewOnlyPermissions = [
            'payroll_legal_parameters.index.view',
            'holidays.index.view',
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

        foreach ($viewOnlyPermissions as $name) {
            if (! PermissionHelper::permissionExists($name)) {
                continue;
            }
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            Role::query()
                ->whereIn('name', ['auxiliar_contable', 'solo_consulta'])
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
