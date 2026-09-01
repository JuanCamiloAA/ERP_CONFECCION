import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
    ArrowRightOnRectangleIcon,
    Bars3Icon,
    BellIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    MoonIcon,
    SunIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from '@inertiajs/react';
import { Fragment, type ReactNode } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import {
    CHROME_LABELS,
    CHROMES,
    DENSITIES,
    DENSITY_LABELS,
    type Chrome,
    type Density,
} from '@/hooks/useLayoutChrome';
import type { ActiveLocation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/types';

interface Props {
    active: ActiveLocation | null;
    title?: string;
    user: AuthUser | null;
    isDark: boolean;
    onToggleTheme: () => void;
    onOpenSearch: () => void;
    onOpenMenu: () => void;
    onLogout: () => void;
    profileHref: string;
    /** Selector de empresa; solo se pinta para super admin. */
    companySwitcher: ReactNode;
    density: Density;
    onDensity: (value: Density) => void;
    chrome: Chrome;
    onChrome: (value: Chrome) => void;
}

/** Iniciales del nombre, para el avatar sin foto. */
function initialsOf(user: AuthUser | null): string {
    const name = user?.full_name ?? '';
    const parts = name.split(/\s+/).filter(Boolean);

    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

/**
 * Navbar de la aplicación.
 *
 * El reparto del espacio es la parte delicada y está fijado a propósito: las migas **no se
 * comprimen** (perder de vista dónde estás es peor que perder el buscador), el nombre de la
 * empresa **nunca se trunca** (en multiempresa es el dato de más jerarquía: saber en qué
 * cliente estás), y el buscador es lo único que cede, con `overflow:hidden` para que jamás
 * se pinte encima de sus vecinos.
 *
 * El nombre del usuario no se muestra: el avatar con iniciales ya lo identifica, y fue lo
 * primero que se sacrificó para que lo demás cupiera.
 */
export function AppNavbar({
    active,
    title,
    user,
    isDark,
    onToggleTheme,
    onOpenSearch,
    onOpenMenu,
    onLogout,
    profileHref,
    companySwitcher,
    density,
    onDensity,
    chrome,
    onChrome,
}: Props) {
    const heading = title ?? active?.item.label ?? 'Inicio';

    return (
        <header
            className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b px-3 sm:px-4"
            style={{ height: 'var(--bar-h)', backgroundColor: 'var(--bar-bg)', borderColor: 'var(--edge)' }}
        >
            <button
                type="button"
                onClick={onOpenMenu}
                aria-label="Abrir menú"
                className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:text-slate-400 dark:hover:bg-slate-700"
            >
                <Bars3Icon className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Izquierda: migas + título. No se comprime. */}
            <div className="hidden shrink-0 basis-auto overflow-hidden lg:block" style={{ maxWidth: 260 }}>
                {active ? (
                    <p className="flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
                        <span className="truncate">{active.area.title}</span>
                        <ChevronRightIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <Link
                            href={active.item.href}
                            className="truncate hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-slate-300"
                        >
                            {active.item.label}
                        </Link>
                    </p>
                ) : null}
                <h1
                    className="truncate font-semibold text-slate-900 dark:text-slate-100"
                    style={{ fontSize: 'var(--title)' }}
                >
                    {heading}
                </h1>
            </div>

            {/* Móvil: área encima del módulo. */}
            <div className="min-w-0 flex-1 lg:hidden">
                {active ? (
                    <p className="truncate text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {active.area.title}
                    </p>
                ) : null}
                <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100">{heading}</p>
            </div>

            {/* Centro: el único bloque que cede espacio. */}
            <div className="hidden min-w-0 flex-1 basis-60 overflow-hidden lg:block">
                <button
                    type="button"
                    onClick={onOpenSearch}
                    className="flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-left text-slate-400 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-700/50"
                >
                    <MagnifyingGlassIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px]">Buscar…</span>
                    <span className="shrink-0 rounded border border-slate-300 px-1 text-[10px] tabular-nums dark:border-slate-600">
                        ⌘K
                    </span>
                </button>
            </div>

            {/* Derecha: no se comprime. */}
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
                <button
                    type="button"
                    onClick={onOpenSearch}
                    aria-label="Buscar"
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:text-slate-400 dark:hover:bg-slate-700"
                >
                    <MagnifyingGlassIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>

                {companySwitcher}

                <button
                    type="button"
                    onClick={onToggleTheme}
                    title={isDark ? 'Modo claro' : 'Modo oscuro'}
                    aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
                    className="hidden h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:flex dark:text-slate-400 dark:hover:bg-slate-700"
                >
                    {isDark ? (
                        <SunIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                    ) : (
                        <MoonIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                    )}
                </button>

                <Link
                    href={profileHref}
                    title="Novedades"
                    aria-label="Novedades"
                    className="relative hidden h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:flex dark:text-slate-400 dark:hover:bg-slate-700"
                >
                    <BellIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>

                <Menu as="div" className="relative shrink-0">
                    <MenuButton
                        aria-label="Menú de cuenta"
                        className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                    >
                        {user?.avatar ? (
                            <Avatar src={user.avatar} name={user.full_name ?? 'Usuario'} size="sm" />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                            >
                                {initialsOf(user)}
                            </span>
                        )}
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
                                {user?.role ? (
                                    <span
                                        className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: `${user.role.color}20`, color: user.role.color }}
                                    >
                                        {user.role.display_name}
                                    </span>
                                ) : null}
                            </div>

                            {/* Ajustes del marco: no son `MenuItem` porque cambiar la densidad
                                no debe cerrar el menú antes de ver el efecto. */}
                            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                                <p className="mb-1 text-[10px] uppercase tracking-[0.11em] text-slate-400">Densidad</p>
                                <div className="flex gap-1" role="group" aria-label="Densidad de la interfaz">
                                    {DENSITIES.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => onDensity(value)}
                                            aria-pressed={density === value}
                                            className={cn(
                                                'flex-1 rounded-md px-1.5 py-1 text-[11px] transition-colors',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                                                density === value
                                                    ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
                                            )}
                                        >
                                            {DENSITY_LABELS[value]}
                                        </button>
                                    ))}
                                </div>

                                <p className="mb-1 mt-2 text-[10px] uppercase tracking-[0.11em] text-slate-400">Marco</p>
                                <div className="flex gap-1" role="group" aria-label="Tratamiento del marco">
                                    {CHROMES.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => onChrome(value)}
                                            aria-pressed={chrome === value}
                                            className={cn(
                                                'flex-1 rounded-md px-1.5 py-1 text-[11px] transition-colors',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                                                chrome === value
                                                    ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
                                            )}
                                        >
                                            {CHROME_LABELS[value]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="py-1">
                                <MenuItem>
                                    {({ focus }) => (
                                        <Link
                                            href={profileHref}
                                            className={cn(
                                                'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                                                focus
                                                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                                                    : 'text-slate-700 dark:text-slate-300',
                                            )}
                                        >
                                            <UserCircleIcon className="h-4 w-4" aria-hidden="true" />
                                            Mi Perfil
                                        </Link>
                                    )}
                                </MenuItem>
                                <MenuItem>
                                    {({ focus }) => (
                                        <button
                                            type="button"
                                            onClick={onLogout}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm',
                                                focus
                                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                                                    : 'text-slate-700 dark:text-slate-300',
                                            )}
                                        >
                                            <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
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
    );
}

export default AppNavbar;
