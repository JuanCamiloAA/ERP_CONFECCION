<?php

namespace App\Helpers;

class PermissionHelper
{
    public static function getPermissionMatrix(): array
    {
        return [
            'dashboard' => [
                'display' => 'Dashboard',
                'icon' => 'HomeIcon',
                'order' => 1,
                'pages' => [
                    'index' => [
                        'display' => 'Inicio',
                        'route' => 'dashboard',
                        'actions' => ['view'],
                    ],
                ],
            ],
            'employees' => [
                'display' => 'Empleados',
                'icon' => 'UsersIcon',
                'order' => 2,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Empleados',
                        'route' => 'employees.index',
                        'actions' => ['view', 'create', 'edit', 'delete', 'export'],
                    ],
                    'show' => [
                        'display' => 'Detalle de Empleado',
                        'route' => 'employees.show',
                        'actions' => ['view', 'edit', 'delete'],
                    ],
                ],
            ],
            'banks' => [
                'display' => 'Bancos',
                'icon' => 'BuildingLibraryIcon',
                'order' => 3,
                'pages' => [
                    'index' => [
                        'display' => 'Bancos',
                        'route' => 'banks.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'references' => [
                'display' => 'Referencias',
                'icon' => 'TagIcon',
                'order' => 4,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Referencias',
                        'route' => 'references.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                    'show' => [
                        'display' => 'Detalle de Referencia',
                        'route' => 'references.show',
                        'actions' => ['view', 'edit'],
                    ],
                ],
            ],
            'operations' => [
                'display' => 'Operaciones',
                'icon' => 'WrenchScrewdriverIcon',
                'order' => 5,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Operaciones',
                        'route' => 'operations.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'productions' => [
                'display' => 'Produccion',
                'icon' => 'ClipboardDocumentListIcon',
                'order' => 6,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Produccion',
                        'route' => 'productions.index',
                        'actions' => ['view', 'create', 'edit', 'delete', 'export', 'workday_start', 'workday_close', 'workday_others'],
                    ],
                    'report' => [
                        'display' => 'Reportes de Produccion',
                        'route' => 'productions.report',
                        'actions' => ['view', 'export'],
                    ],
                ],
            ],
            'payrolls' => [
                'display' => 'Nomina',
                'icon' => 'BanknotesIcon',
                'order' => 7,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Nominas',
                        'route' => 'payrolls.index',
                        'actions' => ['view', 'create', 'delete', 'export'],
                    ],
                    'show' => [
                        'display' => 'Detalle de Nomina',
                        'route' => 'payrolls.show',
                        'actions' => ['view', 'calculate', 'approve', 'pay', 'export', 'edit_time', 'manage_adjustments'],
                    ],
                ],
            ],
            'payroll_concepts' => [
                'display' => 'Conceptos de nomina',
                'icon' => 'DocumentTextIcon',
                'order' => 7.5,
                'pages' => [
                    'index' => [
                        'display' => 'Conceptos de nomina',
                        'route' => 'payroll-concepts.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'advances' => [
                'display' => 'Anticipos',
                'icon' => 'CurrencyDollarIcon',
                'order' => 8,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Anticipos',
                        'route' => 'advances.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'expenses' => [
                'display' => 'Gastos',
                'icon' => 'ReceiptPercentIcon',
                'order' => 9,
                'pages' => [
                    'index' => [
                        'display' => 'Gastos',
                        'route' => 'expenses.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                    'categories' => [
                        'display' => 'Categorias de gastos',
                        'route' => 'expense-categories.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'reports' => [
                'display' => 'Reportes',
                'icon' => 'ChartBarIcon',
                'order' => 10,
                'pages' => [
                    'production' => [
                        'display' => 'Reporte de Produccion',
                        'route' => 'reports.production',
                        'actions' => ['view', 'export'],
                    ],
                    'payroll' => [
                        'display' => 'Reporte de Nomina',
                        'route' => 'reports.payroll',
                        'actions' => ['view', 'export'],
                    ],
                ],
            ],
            'companies' => [
                'display' => 'Empresas',
                'icon' => 'BuildingOfficeIcon',
                'order' => 90,
                'super_admin_only' => true,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Empresas',
                        'route' => 'companies.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'payroll_periodicities' => [
                'display' => 'Periodicidad de pagos',
                'icon' => 'CalendarDaysIcon',
                'order' => 89,
                'super_admin_only' => true,
                'pages' => [
                    'index' => [
                        'display' => 'Maestro periodicidad',
                        'route' => 'payroll-periodicities.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'users' => [
                'display' => 'Usuarios',
                'icon' => 'UserGroupIcon',
                'order' => 91,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Usuarios',
                        'route' => 'users.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                    'edit' => [
                        'display' => 'Excepciones de permisos (por usuario)',
                        'route' => 'users.index',
                        'actions' => ['permission_overrides'],
                    ],
                ],
            ],
            'roles' => [
                'display' => 'Roles y Permisos',
                'icon' => 'ShieldCheckIcon',
                'order' => 92,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Roles',
                        'route' => 'roles.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
            'settings' => [
                'display' => 'Mi empresa',
                'icon' => 'Cog6ToothIcon',
                'order' => 99,
                'pages' => [
                    'index' => [
                        'display' => 'Mi empresa',
                        'route' => 'settings.index',
                        'actions' => ['view', 'edit'],
                    ],
                ],
            ],
        ];
    }

    public static function flatPermissions(): array
    {
        $matrix = self::getPermissionMatrix();
        $permissions = [];

        foreach ($matrix as $module => $config) {
            foreach ($config['pages'] as $page => $pageConfig) {
                foreach ($pageConfig['actions'] as $action) {
                    $permissions[] = "{$module}.{$page}.{$action}";
                }
            }
        }

        return $permissions;
    }

    public static function modules(): array
    {
        $matrix = self::getPermissionMatrix();
        $modules = [];

        foreach ($matrix as $key => $config) {
            $modules[] = [
                'key' => $key,
                'display' => $config['display'],
                'icon' => $config['icon'],
                'order' => $config['order'] ?? 999,
                'super_admin_only' => $config['super_admin_only'] ?? false,
            ];
        }

        usort($modules, fn ($a, $b) => $a['order'] <=> $b['order']);

        return $modules;
    }

    public static function permissionExists(string $permission): bool
    {
        return in_array($permission, self::flatPermissions(), true);
    }

    public static function presetPermissions(string $preset): array
    {
        $matrix = self::getPermissionMatrix();
        $permissions = [];

        switch ($preset) {
            case 'read_only':
                foreach ($matrix as $module => $config) {
                    if ($config['super_admin_only'] ?? false) {
                        continue;
                    }
                    foreach ($config['pages'] as $page => $pageConfig) {
                        if (in_array('view', $pageConfig['actions'], true)) {
                            $permissions[] = "{$module}.{$page}.view";
                        }
                    }
                }
                break;

            case 'operator':
                $permissions = [
                    'dashboard.index.view',
                    'productions.index.view',
                    'productions.index.create',
                    'productions.index.workday_start',
                    'productions.index.workday_close',
                    'productions.report.view',
                    'payrolls.index.view',
                    'payrolls.show.view',
                ];
                break;

            case 'supervisor':
                foreach ($matrix as $module => $config) {
                    if ($config['super_admin_only'] ?? false) {
                        continue;
                    }
                    if (in_array($module, ['users', 'roles', 'settings'], true)) {
                        continue;
                    }
                    foreach ($config['pages'] as $page => $pageConfig) {
                        foreach ($pageConfig['actions'] as $action) {
                            if (! in_array($action, ['delete', 'approve', 'pay'], true)) {
                                $permissions[] = "{$module}.{$page}.{$action}";
                            }
                        }
                    }
                }
                break;

            case 'admin':
                foreach ($matrix as $module => $config) {
                    if ($config['super_admin_only'] ?? false) {
                        continue;
                    }
                    foreach ($config['pages'] as $page => $pageConfig) {
                        foreach ($pageConfig['actions'] as $action) {
                            $permissions[] = "{$module}.{$page}.{$action}";
                        }
                    }
                }
                break;
        }

        return array_values(array_unique($permissions));
    }
}
