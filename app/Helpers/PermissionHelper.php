<?php

namespace App\Helpers;

/**
 * Catalogo de permisos de la aplicacion.
 *
 * Un permiso por accion real, no uno por pantalla. Hasta ahora casi todos los modulos
 * protegian su grupo entero de rutas con un solo `*.index.view`: quien podia ver los
 * anticipos podia tambien crearlos, exportarlos y borrarlos, aunque la interfaz le
 * escondiera los botones. Aqui se declara cada accion con su etiqueta, y `routes/web.php`
 * las exige una a una.
 *
 * Formato de cada pagina:
 *   'actions' => list<string>            claves que forman `modulo.pagina.accion`
 *   'labels'  => array<string, string>   texto que lee un humano en el asignador
 *
 * Los modulos con `super_admin_only` los cubre el middleware `super.admin`; se listan para
 * que el catalogo este completo, pero no se asignan uno a uno porque el super admin ya los
 * tiene todos por definicion.
 */
class PermissionHelper
{
    /** Etiqueta por defecto de los verbos que se repiten en todos los modulos. */
    protected const DEFAULT_ACTION_LABELS = [
        'view' => 'Ver',
        'create' => 'Crear',
        'edit' => 'Editar',
        'delete' => 'Eliminar',
        'export' => 'Exportar',
    ];

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
                        'actions' => ['view', 'customize'],
                        'labels' => [
                            'view' => 'Ver el dashboard',
                            'customize' => 'Reordenar sus tarjetas',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'export', 'deactivate', 'reactivate'],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Crear empleado',
                            'edit' => 'Editar empleado',
                            'delete' => 'Eliminar empleado',
                            'export' => 'Exportar listado',
                            'deactivate' => 'Desactivar empleado',
                            'reactivate' => 'Reactivar empleado',
                        ],
                    ],
                    'show' => [
                        'display' => 'Ficha de Empleado',
                        'route' => 'employees.show',
                        'actions' => ['view', 'edit', 'delete'],
                        'labels' => [
                            'view' => 'Ver ficha',
                            'edit' => 'Editar desde la ficha',
                            'delete' => 'Eliminar desde la ficha',
                        ],
                    ],
                    'access' => [
                        'display' => 'Acceso al sistema',
                        'route' => 'employees.show',
                        'actions' => ['create', 'reset_password', 'change_role', 'toggle'],
                        'labels' => [
                            'create' => 'Crear usuario de acceso',
                            'reset_password' => 'Restablecer contraseña',
                            'change_role' => 'Cambiar el rol',
                            'toggle' => 'Activar / desactivar el acceso',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'toggle'],
                        'labels' => [
                            'view' => 'Ver bancos',
                            'create' => 'Crear banco',
                            'edit' => 'Editar banco',
                            'delete' => 'Eliminar banco',
                            'toggle' => 'Activar / desactivar',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'duplicate', 'export_excel', 'export_pdf', 'recalculate_difficulty'],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Crear referencia',
                            'edit' => 'Editar referencia',
                            'delete' => 'Eliminar referencia',
                            'duplicate' => 'Duplicar referencia',
                            'export_excel' => 'Exportar Excel',
                            'export_pdf' => 'Exportar PDF',
                            'recalculate_difficulty' => 'Recalcular dificultad',
                        ],
                    ],
                    'show' => [
                        'display' => 'Detalle de Referencia',
                        'route' => 'references.show',
                        'actions' => ['view', 'edit'],
                        'labels' => [
                            'view' => 'Ver detalle',
                            'edit' => 'Editar desde el detalle',
                        ],
                    ],
                    'operations' => [
                        'display' => 'Operaciones de la referencia',
                        'route' => 'references.show',
                        'actions' => ['attach', 'update', 'detach', 'recalculate'],
                        'labels' => [
                            'attach' => 'Agregar operación',
                            'update' => 'Editar precio o minutos',
                            'detach' => 'Quitar operación',
                            'recalculate' => 'Recalcular costos',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'duplicate', 'bulk_status', 'edit_price'],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Crear operación',
                            'edit' => 'Editar operación',
                            'delete' => 'Eliminar operación',
                            'duplicate' => 'Duplicar operación',
                            'bulk_status' => 'Activar / desactivar en lote',
                            'edit_price' => 'Cambiar el precio base',
                        ],
                    ],
                    'show' => [
                        'display' => 'Detalle de Operación',
                        'route' => 'operations.show',
                        'actions' => ['view'],
                        'labels' => ['view' => 'Ver detalle'],
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
                        'actions' => [
                            'view', 'create', 'edit', 'delete', 'export',
                            'confirm', 'confirm_day',
                            'workday_start', 'workday_close', 'workday_others',
                        ],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Registrar producción',
                            'edit' => 'Editar registro',
                            'delete' => 'Eliminar registro',
                            'export' => 'Exportar listado',
                            'confirm' => 'Confirmar un registro',
                            'confirm_day' => 'Confirmar el día completo',
                            'workday_start' => 'Abrir jornada',
                            'workday_close' => 'Cerrar jornada',
                            'workday_others' => 'Abrir o cerrar la jornada de otros',
                        ],
                    ],
                    'report' => [
                        'display' => 'Reportes de Produccion',
                        'route' => 'productions.report',
                        'actions' => ['view', 'export'],
                        'labels' => ['view' => 'Ver reporte', 'export' => 'Exportar reporte'],
                    ],
                    'ranking' => [
                        'display' => 'Ranking de Produccion',
                        'route' => 'productions.ranking',
                        'actions' => ['view'],
                        'labels' => ['view' => 'Ver ranking'],
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
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Crear nómina',
                            'delete' => 'Eliminar nómina',
                            'export' => 'Exportar el listado',
                        ],
                    ],
                    'show' => [
                        'display' => 'Detalle de Nomina',
                        'route' => 'payrolls.show',
                        'actions' => ['view', 'calculate', 'approve', 'pay', 'export', 'edit_time', 'manage_adjustments'],
                        'labels' => [
                            'view' => 'Ver detalle',
                            'calculate' => 'Calcular / recalcular',
                            'approve' => 'Aprobar nómina',
                            'pay' => 'Marcar como pagada',
                            'export' => 'Imprimir informes',
                            'edit_time' => 'Ajustar minutos de jornada',
                            'manage_adjustments' => 'Gestionar conceptos y anticipos',
                        ],
                    ],
                    'employee' => [
                        'display' => 'Empleado dentro de la nomina',
                        'route' => 'payrolls.show',
                        'actions' => ['view', 'receipt'],
                        'labels' => [
                            'view' => 'Ver la ficha del empleado',
                            'receipt' => 'Imprimir su comprobante',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'reorder', 'toggle'],
                        'labels' => [
                            'view' => 'Ver conceptos',
                            'create' => 'Crear concepto',
                            'edit' => 'Editar concepto',
                            'delete' => 'Eliminar concepto',
                            'reorder' => 'Reordenar',
                            'toggle' => 'Activar / desactivar',
                        ],
                    ],
                ],
            ],

            'payroll_legal_parameters' => [
                'display' => 'Parametros Legales de Nomina',
                'icon' => 'ScaleIcon',
                'order' => 7.6,
                'pages' => [
                    'index' => [
                        'display' => 'Parametros Legales',
                        'route' => 'payroll-legal-parameters.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                        'labels' => [
                            'view' => 'Ver parámetros',
                            'create' => 'Crear vigencia',
                            'edit' => 'Editar vigencia',
                            'delete' => 'Eliminar vigencia',
                        ],
                    ],
                ],
            ],

            'holidays' => [
                'display' => 'Festivos',
                'icon' => 'CalendarDaysIcon',
                'order' => 7.7,
                'pages' => [
                    'index' => [
                        'display' => 'Festivos',
                        'route' => 'holidays.index',
                        'actions' => ['view', 'create', 'delete', 'sync'],
                        'labels' => [
                            'view' => 'Ver calendario',
                            'create' => 'Agregar festivo manual',
                            'delete' => 'Eliminar festivo',
                            'sync' => 'Sincronizar el año',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'export'],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Registrar anticipo',
                            'edit' => 'Editar anticipo',
                            'delete' => 'Eliminar anticipo',
                            'export' => 'Exportar listado',
                        ],
                    ],
                    'show' => [
                        'display' => 'Detalle de Anticipo',
                        'route' => 'advances.show',
                        'actions' => ['view', 'receipt'],
                        'labels' => [
                            'view' => 'Ver detalle',
                            'receipt' => 'Imprimir comprobante',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'export', 'quick_create'],
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Registrar gasto',
                            'edit' => 'Editar gasto',
                            'delete' => 'Eliminar gasto',
                            'export' => 'Exportar listado',
                            'quick_create' => 'Captura rápida desde el taller',
                        ],
                    ],
                    'show' => [
                        'display' => 'Detalle de Gasto',
                        'route' => 'expenses.show',
                        'actions' => ['view'],
                        'labels' => ['view' => 'Ver detalle'],
                    ],
                    'categories' => [
                        'display' => 'Categorias de gastos',
                        'route' => 'expense-categories.index',
                        'actions' => ['view', 'create', 'edit', 'delete', 'reorder', 'toggle'],
                        'labels' => [
                            'view' => 'Ver categorías',
                            'create' => 'Crear categoría',
                            'edit' => 'Editar categoría',
                            'delete' => 'Eliminar categoría',
                            'reorder' => 'Reordenar',
                            'toggle' => 'Activar / desactivar',
                        ],
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
                        'labels' => ['view' => 'Ver reporte', 'export' => 'Exportar reporte'],
                    ],
                    'payroll' => [
                        'display' => 'Reporte de Nomina',
                        'route' => 'reports.payroll',
                        'actions' => ['view', 'export'],
                        'labels' => ['view' => 'Ver reporte', 'export' => 'Exportar reporte'],
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
                        'labels' => [
                            'view' => 'Ver listado',
                            'create' => 'Crear usuario',
                            'edit' => 'Editar usuario',
                            'delete' => 'Eliminar usuario',
                        ],
                    ],
                    'show' => [
                        'display' => 'Ficha de Usuario',
                        'route' => 'users.show',
                        'actions' => ['view'],
                        'labels' => ['view' => 'Ver ficha'],
                    ],
                    // La clave `edit.permission_overrides` es historica: se conserva para no
                    // invalidar lo que los roles ya tienen concedido.
                    'edit' => [
                        'display' => 'Permisos por usuario',
                        'route' => 'users.index',
                        'actions' => ['permission_overrides'],
                        'labels' => ['permission_overrides' => 'Asignar permisos a un usuario'],
                    ],
                ],
            ],

            'roles' => [
                'display' => 'Roles y Permisos',
                'icon' => 'ShieldCheckIcon',
                'order' => 92,
                'pages' => [
                    'index' => [
                        'display' => 'Plantillas de permisos',
                        'route' => 'roles.index',
                        'actions' => ['view', 'create', 'edit', 'delete', 'propagate'],
                        'labels' => [
                            'view' => 'Ver plantillas',
                            'create' => 'Crear plantilla',
                            'edit' => 'Editar plantilla',
                            'delete' => 'Eliminar plantilla',
                            'propagate' => 'Aplicar cambios a los usuarios',
                        ],
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
                        'labels' => ['view' => 'Ver datos', 'edit' => 'Editar datos'],
                    ],
                ],
            ],

            /*
            |------------------------------------------------------------------
            | Modulos de super administrador
            |------------------------------------------------------------------
            |
            | Los cubre el middleware `super.admin`, no un permiso: el super admin
            | los tiene todos por definicion y a nadie mas se le pueden asignar. Se
            | listan para que el catalogo refleje la aplicacion completa.
            */
            'companies' => [
                'display' => 'Empresas',
                'icon' => 'BuildingOfficeIcon',
                'order' => 90,
                'super_admin_only' => true,
                'pages' => [
                    'index' => [
                        'display' => 'Listado de Empresas',
                        'route' => 'companies.index',
                        'actions' => ['view', 'create', 'edit', 'delete', 'export'],
                        'labels' => [
                            'view' => 'Ver empresas',
                            'create' => 'Crear empresa',
                            'edit' => 'Editar empresa',
                            'delete' => 'Desactivar empresa',
                            'export' => 'Exportar listado',
                        ],
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
                        'actions' => ['view', 'create', 'edit', 'delete', 'reorder', 'toggle'],
                        'labels' => [
                            'view' => 'Ver periodicidades',
                            'create' => 'Crear periodicidad',
                            'edit' => 'Editar periodicidad',
                            'delete' => 'Eliminar periodicidad',
                            'reorder' => 'Reordenar',
                            'toggle' => 'Activar / desactivar',
                        ],
                    ],
                ],
            ],

            'dashboard_builder' => [
                'display' => 'Constructor de Dashboards',
                'icon' => 'Cog6ToothIcon',
                'order' => 88,
                'super_admin_only' => true,
                'pages' => [
                    'index' => [
                        'display' => 'Widgets de Dashboard',
                        'route' => 'super-admin.dashboard-widgets.index',
                        'actions' => ['view', 'create', 'edit', 'delete'],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function flatPermissions(): array
    {
        $permissions = [];

        foreach (self::getPermissionMatrix() as $module => $config) {
            foreach ($config['pages'] as $page => $pageConfig) {
                foreach ($pageConfig['actions'] as $action) {
                    $permissions[] = "{$module}.{$page}.{$action}";
                }
            }
        }

        return $permissions;
    }

    /**
     * Permisos asignables a un usuario de empresa: todo menos los modulos de super admin.
     *
     * @return list<string>
     */
    public static function assignablePermissions(): array
    {
        $permissions = [];

        foreach (self::getPermissionMatrix() as $module => $config) {
            if ($config['super_admin_only'] ?? false) {
                continue;
            }
            foreach ($config['pages'] as $page => $pageConfig) {
                foreach ($pageConfig['actions'] as $action) {
                    $permissions[] = "{$module}.{$page}.{$action}";
                }
            }
        }

        return $permissions;
    }

    /**
     * Etiqueta legible de una accion concreta.
     */
    public static function actionLabel(string $module, string $page, string $action): string
    {
        $pageConfig = self::getPermissionMatrix()[$module]['pages'][$page] ?? null;

        return $pageConfig['labels'][$action]
            ?? self::DEFAULT_ACTION_LABELS[$action]
            ?? ucfirst(str_replace('_', ' ', $action));
    }

    /**
     * Catalogo listo para pintar el asignador: modulos, sus paginas y cada permiso con su
     * etiqueta. Se arma aqui y no en el front para que el nombre tecnico y el texto que lee
     * el administrador no se separen nunca.
     *
     * @return list<array<string, mixed>>
     */
    public static function catalogue(bool $includeSuperAdminOnly = false): array
    {
        $modules = [];

        foreach (self::getPermissionMatrix() as $moduleKey => $config) {
            $superAdminOnly = (bool) ($config['super_admin_only'] ?? false);

            if ($superAdminOnly && ! $includeSuperAdminOnly) {
                continue;
            }

            $groups = [];
            $count = 0;

            foreach ($config['pages'] as $pageKey => $pageConfig) {
                $permissions = [];

                foreach ($pageConfig['actions'] as $action) {
                    $permissions[] = [
                        'name' => "{$moduleKey}.{$pageKey}.{$action}",
                        'label' => self::actionLabel($moduleKey, $pageKey, $action),
                    ];
                    $count++;
                }

                $groups[] = [
                    'key' => $pageKey,
                    'display' => $pageConfig['display'] ?? $pageKey,
                    'permissions' => $permissions,
                ];
            }

            $modules[] = [
                'key' => $moduleKey,
                'display' => $config['display'],
                'icon' => $config['icon'] ?? null,
                'order' => $config['order'] ?? 999,
                'super_admin_only' => $superAdminOnly,
                'total' => $count,
                'groups' => $groups,
            ];
        }

        usort($modules, fn ($a, $b) => $a['order'] <=> $b['order']);

        return $modules;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function modules(): array
    {
        $modules = [];

        foreach (self::getPermissionMatrix() as $key => $config) {
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

    /**
     * @return list<string>
     */
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
                    'productions.ranking.view',
                    'payrolls.index.view',
                    'payrolls.show.view',
                    'payrolls.employee.view',
                    'payrolls.employee.receipt',
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
                $permissions = self::assignablePermissions();
                break;
        }

        return array_values(array_unique($permissions));
    }
}
