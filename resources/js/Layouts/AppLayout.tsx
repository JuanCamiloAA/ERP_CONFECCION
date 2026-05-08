import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
    ArrowRightOnRectangleIcon,
    ArrowUpTrayIcon,
    BanknotesIcon,
    Bars3Icon,
    BuildingLibraryIcon,
    BuildingOfficeIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
    CalendarDaysIcon,
    Cog6ToothIcon,
    CurrencyDollarIcon,
    HomeIcon,
    MoonIcon,
    ShieldCheckIcon,
    SunIcon,
    TagIcon,
    UserCircleIcon,
    UserGroupIcon,
    UsersIcon,
    WrenchScrewdriverIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Link, router, usePage } from '@inertiajs/react';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/Components/UI/Avatar';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { cn } from '@/lib/utils';

const moduleIcons: Record<string, typeof HomeIcon> = {
    dashboard: HomeIcon,
    employees: UsersIcon,
    banks: BuildingLibraryIcon,
    references: TagIcon,
    operations: WrenchScrewdriverIcon,
    productions: ClipboardDocumentListIcon,
    payrolls: BanknotesIcon,
    advances: CurrencyDollarIcon,
    reports: ChartBarIcon,
    companies: BuildingOfficeIcon,
    payroll_periodicities: CalendarDaysIcon,
    users: UserGroupIcon,
    roles: ShieldCheckIcon,
    settings: Cog6ToothIcon,
};

interface NavItem {
    key: string;
    label: string;
    href: string;
    icon: typeof HomeIcon;
    section: 'main' | 'production' | 'payroll' | 'admin';
}

interface AppLayoutProps {
    children: ReactNode;
    title?: string;
}

const moduleSections: Record<string, NavItem['section']> = {
    dashboard: 'main',
    employees: 'main',
    banks: 'main',
    references: 'production',
    operations: 'production',
    productions: 'production',
    payrolls: 'payroll',
    advances: 'payroll',
    reports: 'main',
    companies: 'admin',
    payroll_periodicities: 'admin',
    users: 'admin',
    roles: 'admin',
    settings: 'admin',
};

const moduleLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    employees: 'Empleados',
    banks: 'Bancos',
    references: 'Referencias',
    operations: 'Operaciones',
    productions: 'Produccion',
    payrolls: 'Nomina',
    advances: 'Anticipos',
    reports: 'Reportes',
    companies: 'Empresas',
    payroll_periodicities: 'Periodicidad de pagos',
    users: 'Usuarios',
    roles: 'Roles y Permisos',
    settings: 'Mi empresa',
};

const moduleRoutes: Record<string, string> = {
    dashboard: 'dashboard',
    employees: 'employees.index',
    banks: 'banks.index',
    references: 'references.index',
    operations: 'operations.index',
    productions: 'productions.index',
    payrolls: 'payrolls.index',
    advances: 'advances.index',
    'reports.production': 'reports.production',
    'reports.payroll': 'reports.payroll',
    companies: 'companies.index',
    payroll_periodicities: 'payroll-periodicities.index',
    users: 'users.index',
    roles: 'roles.index',
    settings: 'settings.index',
};

const sectionTitles: Record<NavItem['section'], string> = {
    main: 'Principal',
    production: 'Produccion',
    payroll: 'Nomina',
    admin: 'Administracion',
};

const sectionOrder: NavItem['section'][] = ['main', 'production', 'payroll', 'admin'];

function buildNavigation(accessiblePages: string[], isSuperAdmin: boolean): NavItem[] {
    const items: NavItem[] = [];
    const seenModules = new Set<string>();

    accessiblePages.forEach((page) => {
        const [module] = page.split('.');

        if (module === 'reports') {
            const routeName = moduleRoutes[page];
            if (routeName) {
                items.push({
                    key: page,
                    label: page.endsWith('production') ? 'Reporte Produccion' : 'Reporte Nomina',
                    href: page.endsWith('production') ? '/reports/production' : '/reports/payroll',
                    icon: ChartBarIcon,
                    section: 'main',
                });
            }
            return;
        }

        if (seenModules.has(module)) return;
        seenModules.add(module);

        if (module === 'companies' && !isSuperAdmin) return;

        const routeKey = moduleRoutes[module];
        if (!routeKey) return;

        const icon = moduleIcons[module] ?? HomeIcon;
        const section = moduleSections[module] ?? 'main';

        items.push({
            key: module,
            label: moduleLabels[module] ?? module,
            href: getRouteUrl(routeKey),
            icon,
            section,
        });
    });

    return items;
}

function getRouteUrl(routeName: string): string {
    try {
        return route(routeName);
    } catch {
        return '#';
    }
}

export default function AppLayout({ children, title }: AppLayoutProps) {
    const page = usePage();
    const props = page.props as unknown as App.PageProps;
    const flash = props.flash;
    const appName = props.appName;
    const activeCompany = props.activeCompany;

    const { user, accessiblePages, isSuperAdmin } = usePermissions();
    const { isDark, toggle: toggleTheme } = useDarkMode();

    /** Marca del sidebar: empresa activa (o la del usuario) o nombre de la app. */
    const sidebarBrand = activeCompany ?? user?.company ?? null;
    const brandTitle = sidebarBrand?.name ?? appName;

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning) toast.warning(flash.warning);
        if (flash?.info) toast.info(flash.info);
    }, [flash]);

    useEffect(() => {
        if (title) {
            document.title = `${title} | ${brandTitle}`;
        }
    }, [title, brandTitle]);

    const navigation = useMemo(() => {
        const base = buildNavigation(accessiblePages, isSuperAdmin);
        if (!isSuperAdmin) {
            return base;
        }
        return [
            ...base,
            {
                key: 'data-imports',
                label: 'Carga masiva (CSV)',
                href: getRouteUrl('super-admin.data-imports.index'),
                icon: ArrowUpTrayIcon,
                section: 'admin' as const,
            },
        ];
    }, [accessiblePages, isSuperAdmin]);

    const brandLogoUrl = sidebarBrand?.logo ? `/storage/${sidebarBrand.logo}` : null;

    const groupedNav = sectionOrder.reduce<Record<string, NavItem[]>>((acc, section) => {
        const items = navigation.filter((item) => item.section === section);
        if (items.length > 0) {
            acc[section] = items;
        }
        return acc;
    }, {});

    const handleLogout = () => {
        router.post(route('logout'));
    };

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Sidebar mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white shadow-lg transition-all',
                    'dark:border-slate-700 dark:bg-slate-800',
                    'lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:shadow-none',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    collapsed ? 'lg:w-[72px]' : 'lg:w-64',
                    'w-64',
                )}
            >
                {/* Sidebar header: logo y nombre de la empresa (o app por defecto) */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
                    <Link href={getRouteUrl('dashboard')} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden" title={brandTitle}>
                        {brandLogoUrl ? (
                            <img
                                src={brandLogoUrl}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600/80"
                            />
                        ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7 3.5v8.64l-7 3.5-7-3.5V7.68l7-3.5z" />
                                </svg>
                            </div>
                        )}
                        {!collapsed && (
                            <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{brandTitle}</span>
                        )}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(false)}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-700"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="scrollbar-thin flex-1 overflow-y-auto py-4">
                    {Object.entries(groupedNav).map(([section, items]) => (
                        <div key={section} className="px-3 pb-4">
                            {!collapsed && (
                                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    {sectionTitles[section as NavItem['section']]}
                                </p>
                            )}
                            <ul className="space-y-1">
                                {items.map((item) => {
                                    const isActive = page.url.startsWith(new URL(item.href, window.location.origin).pathname) && item.href !== '#';
                                    const Icon = item.icon;

                                    return (
                                        <li key={item.key}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setSidebarOpen(false)}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                                    isActive
                                                        ? 'border-l-4 border-indigo-600 bg-indigo-50 pl-2 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
                                                    collapsed && 'justify-center',
                                                )}
                                                title={collapsed ? item.label : undefined}
                                            >
                                                <Icon className="h-5 w-5 shrink-0" />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Sidebar footer (collapse button) */}
                <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => setCollapsed((c) => !c)}
                        className="hidden w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 lg:flex dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                        <Bars3Icon className="h-4 w-4" />
                        {!collapsed && <span>Contraer</span>}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Header */}
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                        <Bars3Icon className="h-5 w-5" />
                    </button>

                    <div className="flex-1">
                        {title && (
                            <h1 className="text-base font-semibold text-slate-900 lg:hidden dark:text-slate-100">
                                {title}
                            </h1>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            title={isDark ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                        </button>

                        <Menu as="div" className="relative">
                            <MenuButton className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                                <Avatar src={user?.avatar} name={user?.full_name ?? 'Usuario'} size="sm" />
                                <span className="hidden text-sm font-medium text-slate-700 sm:block dark:text-slate-200">
                                    {user?.full_name}
                                </span>
                            </MenuButton>
                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <MenuItems className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg focus:outline-none dark:border-slate-700 dark:bg-slate-800">
                                    <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-700">
                                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {user?.full_name}
                                        </p>
                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                                        {user?.role && (
                                            <span
                                                className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                style={{
                                                    backgroundColor: `${user.role.color}20`,
                                                    color: user.role.color,
                                                }}
                                            >
                                                {user.role.display_name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="py-1">
                                        <MenuItem>
                                            {({ focus }) => (
                                                <Link
                                                    href={getRouteUrl('profile.edit')}
                                                    className={cn(
                                                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                                                        focus
                                                            ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                                                            : 'text-slate-700 dark:text-slate-300',
                                                    )}
                                                >
                                                    <UserCircleIcon className="h-4 w-4" />
                                                    Mi Perfil
                                                </Link>
                                            )}
                                        </MenuItem>
                                        <MenuItem>
                                            {({ focus }) => (
                                                <button
                                                    onClick={handleLogout}
                                                    className={cn(
                                                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm',
                                                        focus
                                                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                                            : 'text-slate-700 dark:text-slate-300',
                                                    )}
                                                >
                                                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                                    Cerrar Sesion
                                                </button>
                                            )}
                                        </MenuItem>
                                    </div>
                                </MenuItems>
                            </Transition>
                        </Menu>
                    </div>
                </header>

                {/* Main */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="mx-auto max-w-7xl">{children}</div>
                </main>
            </div>
        </div>
    );
}
