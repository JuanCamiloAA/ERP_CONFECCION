<?php

namespace App\Services;

use App\Helpers\PermissionHelper;
use App\Models\Company;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Crea o actualiza el conjunto estandar de roles de cada empresa (admin, supervisor, etc.).
 * Sin filas en `roles` por company_id, un usuario movido a esa empresa no puede tener rol "admin".
 */
class CompanyDefaultRolesService
{
    public function ensureDefaultRolesForCompany(Company $company, bool $forgetPermissionCache = true): void
    {
        $companyId = $company->id;

        $admin = Role::updateOrCreate(
            [
                'name' => 'admin',
                'guard_name' => 'web',
                'company_id' => $companyId,
            ],
            [
                'display_name' => 'Administrador',
                'description' => 'Administrador con acceso total a su empresa.',
                'color' => '#4f46e5',
                'is_system' => true,
            ]
        );
        $admin->syncPermissions(PermissionHelper::presetPermissions('admin'));

        $supervisor = Role::updateOrCreate(
            [
                'name' => 'supervisor_produccion',
                'guard_name' => 'web',
                'company_id' => $companyId,
            ],
            [
                'display_name' => 'Supervisor de Produccion',
                'description' => 'Gestiona empleados, produccion y reportes.',
                'color' => '#0ea5e9',
                'is_system' => false,
            ]
        );
        $supervisor->syncPermissions([
            'dashboard.index.view',
            'employees.index.view',
            'employees.show.view',
            'references.index.view',
            'references.show.view',
            'operations.index.view',
            'productions.index.view',
            'productions.index.create',
            'productions.index.edit',
            'productions.index.workday_start',
            'productions.index.workday_close',
            'productions.index.workday_others',
            'productions.report.view',
            'productions.report.export',
            'reports.production.view',
            'reports.production.export',
        ]);

        $accountant = Role::updateOrCreate(
            [
                'name' => 'auxiliar_contable',
                'guard_name' => 'web',
                'company_id' => $companyId,
            ],
            [
                'display_name' => 'Auxiliar Contable',
                'description' => 'Maneja nominas, anticipos y reportes contables.',
                'color' => '#10b981',
                'is_system' => false,
            ]
        );
        $accountant->syncPermissions([
            'dashboard.index.view',
            'employees.index.view',
            'employees.show.view',
            'payrolls.index.view',
            'payrolls.index.create',
            'payrolls.index.export',
            'payrolls.show.view',
            'payrolls.show.calculate',
            'payrolls.show.export',
            'payrolls.show.edit_time',
            'payrolls.show.manage_adjustments',
            'payroll_concepts.index.view',
            'payroll_concepts.index.create',
            'payroll_concepts.index.edit',
            'banks.index.view',
            'banks.index.create',
            'banks.index.edit',
            'banks.index.delete',
            'advances.index.view',
            'advances.index.create',
            'reports.payroll.view',
            'reports.payroll.export',
            'expenses.index.view',
            'expenses.index.create',
            'expenses.index.edit',
            'expenses.index.delete',
            'expenses.categories.view',
            'expenses.categories.create',
            'expenses.categories.edit',
            'expenses.categories.delete',
        ]);

        $viewer = Role::updateOrCreate(
            [
                'name' => 'solo_consulta',
                'guard_name' => 'web',
                'company_id' => $companyId,
            ],
            [
                'display_name' => 'Solo Consulta',
                'description' => 'Acceso de solo lectura a todos los modulos.',
                'color' => '#64748b',
                'is_system' => false,
            ]
        );
        $viewer->syncPermissions(PermissionHelper::presetPermissions('read_only'));

        $operator = Role::updateOrCreate(
            [
                'name' => 'operario_produccion',
                'guard_name' => 'web',
                'company_id' => $companyId,
            ],
            [
                'display_name' => 'Operario de Produccion',
                'description' => 'Empleado que solo ve sus propias producciones y pagos.',
                'color' => '#f59e0b',
                'is_system' => false,
            ]
        );
        $operator->syncPermissions(PermissionHelper::presetPermissions('operator'));

        $this->grantOverridePermissionToAdmin($admin);

        if ($forgetPermissionCache) {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }
    }

    protected function grantOverridePermissionToAdmin(Role $adminRole): void
    {
        $name = 'users.edit.permission_overrides';

        if (! PermissionHelper::permissionExists($name)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => $name, 'guard_name' => 'web'],
        );

        if (! $adminRole->hasPermissionTo($permission)) {
            $adminRole->givePermissionTo($permission);
        }
    }
}
