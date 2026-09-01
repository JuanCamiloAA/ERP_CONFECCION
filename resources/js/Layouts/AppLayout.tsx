import { XMarkIcon } from '@heroicons/react/24/outline';
import { router, usePage } from '@inertiajs/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppNavbar } from '@/Components/Layout/AppNavbar';
import { CommandPalette } from '@/Components/Layout/CommandPalette';
import { MobileTabBar } from '@/Components/Layout/MobileTabBar';
import { SidebarGroups } from '@/Components/Layout/SidebarGroups';
import { SidebarRail } from '@/Components/Layout/SidebarRail';
import { SuperAdminCompanySwitcher } from '@/Components/SuperAdminCompanySwitcher';
import { ImageLightboxProvider } from '@/Components/UI/ImageLightbox';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useLayoutChrome } from '@/hooks/useLayoutChrome';
import { mediaUrl } from '@/lib/mediaUrl';
import { buildAreas, findActive, mobileAreas } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Variante del sidebar. `groups` = áreas plegables; `rail` = rail de iconos + panel.
 *
 * Es una constante y no un ajuste de usuario a propósito: son dos modelos mentales
 * distintos de la misma navegación, y dejar elegir obliga a cada persona a aprender los dos.
 */
const SIDEBAR_VARIANT: 'groups' | 'rail' = 'groups';

const COLLAPSED_KEY = 'erp.sidebar.collapsed';

interface AppLayoutProps {
    children: ReactNode;
    title?: string;
}

function getRouteUrl(routeName: string): string {
    try {
        return route(routeName);
    } catch {
        return '#';
    }
}

function readCollapsed(): boolean {
    if (typeof window === 'undefined') return false;

    try {
        return window.localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

export default function AppLayout({ children, title }: AppLayoutProps) {
    const page = usePage();
    const props = page.props as unknown as App.PageProps;
    const flash = props.flash;
    const appName = props.appName;
    const activeCompany = props.activeCompany;
    const brandLogo = props.brandLogo;

    const { user, accessiblePages, isSuperAdmin } = usePermissions();
    const { isDark, toggle: toggleTheme } = useDarkMode();
    const { density, setDensity, chrome, setChrome } = useLayoutChrome();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());
    const [searchOpen, setSearchOpen] = useState(false);

    const sidebarBrand = activeCompany ?? user?.company ?? null;
    const brandTitle = sidebarBrand?.name ?? appName;
    const companyLogoUrl = sidebarBrand?.logo ? (mediaUrl(sidebarBrand.logo) ?? null) : null;
    // El plan solo llega en `activeCompany`; `user.company` es un resumen sin relaciones.
    const planName = activeCompany?.membership_plan?.name ?? null;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning) toast.warning(flash.warning);
        if (flash?.info) toast.info(flash.info);
    }, [flash]);

    useEffect(() => {
        if (title) document.title = `${title} | ${brandTitle}`;
    }, [title, brandTitle]);

    useEffect(() => {
        try {
            window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
        } catch {
            /* almacenamiento bloqueado */
        }
    }, [collapsed]);

    // ⌘K / Ctrl+K desde cualquier pantalla. El atajo se retira al desmontar para que no se
    // acumule un listener por cada navegación.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setSearchOpen((open) => ! open);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const areas = useMemo(
        () => buildAreas(accessiblePages, isSuperAdmin),
        [accessiblePages, isSuperAdmin],
    );

    const active = useMemo(() => findActive(areas, page.url), [areas, page.url]);
    const tabs = useMemo(() => mobileAreas(areas), [areas]);

    const brand = {
        href: getRouteUrl('dashboard'),
        title: brandTitle,
        subtitle: planName,
        logoUrl: companyLogoUrl,
        brandLogo,
    };

    const sidebarWidth = SIDEBAR_VARIANT === 'rail'
        ? collapsed
            ? 'var(--rail-icon-w)'
            : 'calc(var(--rail-icon-w) + var(--panel-w))'
        : collapsed
          ? 'var(--rail-collapsed)'
          : 'var(--rail-w)';

    const sidebar =
        SIDEBAR_VARIANT === 'rail' ? (
            <SidebarRail
                areas={areas}
                active={active}
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed((c) => ! c)}
                onNavigate={() => setDrawerOpen(false)}
                brand={brand}
            />
        ) : (
            <SidebarGroups
                areas={areas}
                active={active}
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed((c) => ! c)}
                onNavigate={() => setDrawerOpen(false)}
                brand={brand}
            />
        );

    return (
        <ImageLightboxProvider>
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:bg-slate-800"
            >
                Saltar al contenido
            </a>

            <div className="flex min-h-screen bg-[var(--app-bg)]">
                {drawerOpen ? (
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden="true"
                    />
                ) : null}

                <aside
                    className={cn(
                        'fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r shadow-lg transition-transform',
                        'lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:shadow-none',
                        drawerOpen ? 'translate-x-0' : '-translate-x-full',
                    )}
                    style={{
                        width: sidebarWidth,
                        // En móvil el cajón siempre va expandido: colapsado no cabe el texto y
                        // el usuario no tiene el botón de contraer a mano.
                        minWidth: drawerOpen ? 'var(--rail-w)' : undefined,
                        backgroundColor: 'var(--side-bg)',
                        borderColor: 'var(--edge)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Cerrar menú"
                        className="absolute right-2 top-2 z-10 rounded-md p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:hover:bg-slate-700"
                    >
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>

                    {sidebar}
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <AppNavbar
                        active={active}
                        title={title}
                        user={user}
                        isDark={isDark}
                        onToggleTheme={toggleTheme}
                        onOpenSearch={() => setSearchOpen(true)}
                        onOpenMenu={() => setDrawerOpen(true)}
                        onLogout={() => router.post(route('logout'))}
                        profileHref={getRouteUrl('profile.edit')}
                        companySwitcher={<SuperAdminCompanySwitcher />}
                        density={density}
                        onDensity={setDensity}
                        chrome={chrome}
                        onChrome={setChrome}
                    />

                    <main
                        id="main"
                        tabIndex={-1}
                        className="flex-1 focus:outline-none"
                        style={{
                            paddingTop: 'var(--main-pad-top)',
                            paddingLeft: 'var(--main-pad-x)',
                            paddingRight: 'var(--main-pad-x)',
                            // El alto de la barra inferior se suma abajo para que el contenido
                            // no termine debajo de ella en movil; en escritorio vale 0.
                            paddingBottom: 'calc(var(--main-pad-bottom) + var(--tabbar-h))',
                        }}
                    >
                        <div className="mx-auto" style={{ maxWidth: 'var(--main-max)' }}>
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            <MobileTabBar areas={areas} tabs={tabs} active={active} />

            <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} areas={areas} />
        </ImageLightboxProvider>
    );
}
