import {
    ArrowUpTrayIcon,
    BanknotesIcon,
    BuildingLibraryIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
    Cog6ToothIcon,
    CreditCardIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    HomeIcon,
    PaintBrushIcon,
    PresentationChartLineIcon,
    ReceiptPercentIcon,
    ScaleIcon,
    ShieldCheckIcon,
    Squares2X2Icon,
    TagIcon,
    TrophyIcon,
    UserGroupIcon,
    UsersIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

export type NavIcon = typeof HomeIcon;

export interface NavItem {
    key: string;
    label: string;
    href: string;
    icon: NavIcon;
    /** Número discreto a la derecha del label. Como mucho dos por área. */
    count?: string;
}

export interface NavArea {
    key: string;
    title: string;
    icon: NavIcon;
    items: NavItem[];
    /** Contador de atención del área (jornadas abiertas, nóminas sin cerrar…). */
    badge?: number;
}

/**
 * Definición de un destino antes de filtrar por permisos.
 *
 * `page` es la clave de `accessible_pages` que lo habilita; `superAdminOnly` cubre los
 * destinos que no pasan por el catálogo de permisos (los del super admin).
 */
interface NavDefinition {
    key: string;
    label: string;
    route: string;
    icon: NavIcon;
    page?: string;
    superAdminOnly?: boolean;
}

interface AreaDefinition {
    key: string;
    title: string;
    icon: NavIcon;
    items: NavDefinition[];
}

/**
 * La navegación, ordenada por flujo de trabajo y no por tabla de la base de datos.
 *
 * El criterio del orden —y hay que respetarlo al añadir módulos— es la frecuencia de uso:
 * lo que se toca a diario arriba (Taller), lo mensual en medio (Nómina) y lo que se
 * configura una vez al año abajo (Administración).
 *
 * Dos colocaciones que sorprenden y son deliberadas: **Bancos** vive en Personas porque se
 * usa al dar de alta a un empleado, no al configurar la empresa; y **Mi empresa** encabeza
 * Administración por ser, de largo, lo más visitado de ese grupo.
 */
export const NAV_AREAS: AreaDefinition[] = [
    {
        key: 'inicio',
        title: 'Inicio',
        icon: HomeIcon,
        items: [{ key: 'dashboard', label: 'Dashboard', route: 'dashboard', icon: HomeIcon, page: 'dashboard.index' }],
    },
    {
        key: 'taller',
        title: 'Taller',
        icon: WrenchScrewdriverIcon,
        items: [
            {
                key: 'productions',
                label: 'Producción',
                route: 'productions.index',
                icon: ClipboardDocumentListIcon,
                page: 'productions.index',
            },
            {
                key: 'productions-ranking',
                label: 'Ranking',
                route: 'productions.ranking',
                icon: TrophyIcon,
                page: 'productions.ranking',
            },
            { key: 'references', label: 'Referencias', route: 'references.index', icon: TagIcon, page: 'references.index' },
            {
                key: 'operations',
                label: 'Operaciones',
                route: 'operations.index',
                icon: WrenchScrewdriverIcon,
                page: 'operations.index',
            },
        ],
    },
    {
        key: 'nomina',
        title: 'Nómina',
        icon: BanknotesIcon,
        items: [
            { key: 'payrolls', label: 'Nómina', route: 'payrolls.index', icon: BanknotesIcon, page: 'payrolls.index' },
            {
                key: 'advances',
                label: 'Anticipos',
                route: 'advances.index',
                icon: CurrencyDollarIcon,
                page: 'advances.index',
            },
            { key: 'expenses', label: 'Gastos', route: 'expenses.index', icon: ReceiptPercentIcon, page: 'expenses.index' },
            {
                key: 'expense-categories',
                label: 'Categorías de gastos',
                route: 'expense-categories.index',
                icon: TagIcon,
                page: 'expenses.categories',
            },
            {
                key: 'payroll_concepts',
                label: 'Conceptos',
                route: 'payroll-concepts.index',
                icon: DocumentTextIcon,
                page: 'payroll_concepts.index',
            },
            {
                key: 'payroll_legal_parameters',
                label: 'Parámetros legales',
                route: 'payroll-legal-parameters.index',
                icon: ScaleIcon,
                page: 'payroll_legal_parameters.index',
            },
            { key: 'holidays', label: 'Festivos', route: 'holidays.index', icon: CalendarDaysIcon, page: 'holidays.index' },
        ],
    },
    {
        key: 'personas',
        title: 'Personas',
        icon: UsersIcon,
        items: [
            { key: 'employees', label: 'Empleados', route: 'employees.index', icon: UsersIcon, page: 'employees.index' },
            { key: 'banks', label: 'Bancos', route: 'banks.index', icon: BuildingLibraryIcon, page: 'banks.index' },
            { key: 'users', label: 'Usuarios', route: 'users.index', icon: UserGroupIcon, page: 'users.index' },
            {
                key: 'roles',
                label: 'Roles y permisos',
                route: 'roles.index',
                icon: ShieldCheckIcon,
                page: 'roles.index',
            },
        ],
    },
    {
        key: 'analisis',
        title: 'Análisis',
        icon: ChartBarIcon,
        items: [
            {
                key: 'reports.production',
                label: 'Reporte producción',
                route: 'reports.production',
                icon: ChartBarIcon,
                page: 'reports.production',
            },
            {
                key: 'reports.payroll',
                label: 'Reporte nómina',
                route: 'reports.payroll',
                icon: PresentationChartLineIcon,
                page: 'reports.payroll',
            },
        ],
    },
    {
        key: 'administracion',
        title: 'Administración',
        icon: Cog6ToothIcon,
        items: [
            { key: 'settings', label: 'Mi empresa', route: 'settings.index', icon: Cog6ToothIcon, page: 'settings.index' },
            {
                key: 'companies',
                label: 'Empresas',
                route: 'companies.index',
                icon: BuildingOfficeIcon,
                page: 'companies.index',
                superAdminOnly: true,
            },
            {
                key: 'payroll_periodicities',
                label: 'Periodicidad de pagos',
                route: 'payroll-periodicities.index',
                icon: CalendarDaysIcon,
                page: 'payroll_periodicities.index',
            },
            {
                key: 'membership-plans',
                label: 'Planes de membresía',
                route: 'super-admin.membership-plans.index',
                icon: CreditCardIcon,
                superAdminOnly: true,
            },
            {
                key: 'landing-editor',
                label: 'Landing pública',
                route: 'super-admin.landing.index',
                icon: PaintBrushIcon,
                superAdminOnly: true,
            },
            {
                key: 'data-imports',
                label: 'Carga masiva (CSV)',
                route: 'super-admin.data-imports.index',
                icon: ArrowUpTrayIcon,
                superAdminOnly: true,
            },
            {
                key: 'dashboard_builder',
                label: 'Constructor de dashboards',
                route: 'super-admin.dashboard-widgets.index',
                icon: Squares2X2Icon,
                page: 'dashboard_builder.index',
            },
        ],
    },
];

/** URL de una ruta con nombre; `null` si la ruta no existe en este build. */
function routeUrl(name: string): string | null {
    try {
        return route(name);
    } catch {
        return null;
    }
}

/**
 * Áreas visibles para el usuario.
 *
 * Un área sin ítems accesibles no se devuelve: pintar una cabecera de grupo vacía es peor
 * que no pintarla, porque sugiere que falta algo por cargar.
 */
export function buildAreas(accessiblePages: string[], isSuperAdmin: boolean): NavArea[] {
    const allowed = new Set(accessiblePages);

    return NAV_AREAS.map((area) => {
        const items = area.items.reduce<NavItem[]>((acc, definition) => {
            if (definition.superAdminOnly && ! isSuperAdmin) return acc;

            // El super admin entra a todo; el resto necesita la página en su catálogo.
            if (definition.page && ! isSuperAdmin && ! allowed.has(definition.page)) return acc;

            const href = routeUrl(definition.route);
            if (href === null) return acc;

            acc.push({
                key: definition.key,
                label: definition.label,
                href,
                icon: definition.icon,
            });

            return acc;
        }, []);

        return { key: area.key, title: area.title, icon: area.icon, items };
    }).filter((area) => area.items.length > 0);
}

export interface ActiveLocation {
    area: NavArea;
    item: NavItem;
}

/**
 * Área y módulo de la URL actual.
 *
 * Gana la coincidencia más larga: `/payroll-concepts` y `/payrolls` comparten prefijo con
 * varias rutas, y quedarse con la primera dejaría marcado el destino equivocado.
 */
export function findActive(areas: NavArea[], url: string): ActiveLocation | null {
    const path = url.split('?')[0].split('#')[0];
    let best: ActiveLocation | null = null;
    let bestLength = -1;

    areas.forEach((area) => {
        area.items.forEach((item) => {
            const itemPath = pathOf(item.href);
            if (itemPath === null) return;

            const matches = path === itemPath || path.startsWith(`${itemPath}/`);
            if (! matches) return;

            if (itemPath.length > bestLength) {
                best = { area, item };
                bestLength = itemPath.length;
            }
        });
    });

    return best;
}

/** Ruta absoluta de un href, sin dominio ni parámetros. */
export function pathOf(href: string): string | null {
    if (href === '#' || href === '') return null;

    try {
        return new URL(href, 'http://localhost').pathname;
    } catch {
        return null;
    }
}

/**
 * Las cuatro áreas de la barra inferior más «Más».
 *
 * Se toman de las áreas que el usuario sí puede ver: si no tiene Taller, ese hueco lo ocupa
 * la siguiente con permisos, en vez de dejar un destino muerto.
 */
export function mobileAreas(areas: NavArea[]): NavArea[] {
    const preferred = ['inicio', 'taller', 'nomina', 'personas'];
    const byKey = new Map(areas.map((area) => [area.key, area]));

    const picked = preferred
        .map((key) => byKey.get(key))
        .filter((area): area is NavArea => area !== undefined);

    for (const area of areas) {
        if (picked.length >= 4) break;
        if (! picked.includes(area)) picked.push(area);
    }

    return picked.slice(0, 4);
}
