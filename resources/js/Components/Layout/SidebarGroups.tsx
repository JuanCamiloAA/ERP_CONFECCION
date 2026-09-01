import { Link } from '@inertiajs/react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import type { BrandLogo } from '@/Components/BrandMark';
import { SidebarBrand } from '@/Components/Layout/SidebarBrand';
import type { ActiveLocation, NavArea } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Marcado del ítem activo. Las tres opciones del prototipo, expuestas para poder cambiarlas
 * de un sitio: por defecto **Barra**, que es la que se distingue igual de bien con el
 * sidebar colapsado a 56px, donde una píldora se queda sin espacio para el fondo.
 */
export type ActiveMark = 'bar' | 'pill' | 'text';
export const ACTIVE_MARK: ActiveMark = 'bar';

const GROUPS_KEY = 'erp.sidebar.groups';

interface Props {
    areas: NavArea[];
    active: ActiveLocation | null;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    /** Cierra el cajón en móvil al navegar. */
    onNavigate?: () => void;
    brand: {
        href: string;
        title: string;
        subtitle: string | null;
        logoUrl: string | null;
        brandLogo?: BrandLogo | null;
    };
}

function readOpenGroups(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(GROUPS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;

        return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
    } catch {
        return [];
    }
}

function activeClasses(on: boolean): string {
    if (! on) {
        return 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50';
    }

    if (ACTIVE_MARK === 'pill') {
        return 'rounded-full bg-[var(--on-bg)] font-medium text-[var(--on-fg)]';
    }

    if (ACTIVE_MARK === 'text') {
        return 'font-medium text-[var(--on-fg)]';
    }

    return 'bg-[var(--on-bg)] font-medium text-[var(--on-fg)] shadow-[inset_2px_0_0_var(--on-mark)]';
}

/**
 * Sidebar de grupos plegables (variante A).
 *
 * Solo el área de la página actual arranca abierta. Con las seis desplegadas la lista mide
 * más que la pantalla y obliga a buscar con scroll lo que el menú debería resolver de un
 * vistazo; con todas cerradas, cada navegación costaría dos clics.
 */
export function SidebarGroups({ areas, active, collapsed, onToggleCollapsed, onNavigate, brand }: Props) {
    const [open, setOpen] = useState<string[]>(() => readOpenGroups());

    // El área activa se fuerza abierta sin escribirla en el almacenamiento: es una
    // consecuencia de dónde estás, no una preferencia que el usuario haya expresado.
    const activeAreaKey = active?.area.key ?? null;
    const isOpen = (key: string) => key === activeAreaKey || open.includes(key);

    useEffect(() => {
        try {
            window.localStorage.setItem(GROUPS_KEY, JSON.stringify(open));
        } catch {
            /* almacenamiento bloqueado */
        }
    }, [open]);

    const toggleGroup = (key: string) => {
        setOpen((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
    };

    return (
        <div className="flex h-full flex-col">
            <div
                className="flex shrink-0 items-center border-b px-3"
                style={{ height: 'var(--bar-h)', borderColor: 'var(--edge)' }}
            >
                <SidebarBrand
                    href={brand.href}
                    title={brand.title}
                    subtitle={brand.subtitle}
                    logoUrl={brand.logoUrl}
                    brandLogo={brand.brandLogo}
                    compact={collapsed}
                    className="w-full"
                />
            </div>

            <nav aria-label="Principal" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-3">
                {areas.map((area, index) => {
                    const expanded = isOpen(area.key);
                    const panelId = `sidebar-area-${area.key}`;

                    return (
                        <div key={area.key} style={{ marginBottom: 'var(--group-gap)' }}>
                            {collapsed ? (
                                // Sin cabeceras al colapsar: un divisor basta para separar
                                // áreas y el texto no cabría de todas formas.
                                index > 0 ? (
                                    <div className="mx-2 mb-2 h-px" style={{ backgroundColor: 'var(--edge)' }} />
                                ) : null
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(area.key)}
                                    aria-expanded={expanded}
                                    aria-controls={panelId}
                                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.11em] text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:text-slate-300"
                                >
                                    {expanded ? (
                                        <ChevronDownIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    ) : (
                                        <ChevronRightIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-left">{area.title}</span>
                                    {area.badge ? (
                                        <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                            {area.badge}
                                        </span>
                                    ) : null}
                                </button>
                            )}

                            {collapsed || expanded ? (
                                <ul id={panelId} className="mt-1" style={{ display: 'grid', gap: 'var(--item-gap)' }}>
                                    {area.items.map((item) => {
                                        const on = active?.item.key === item.key;
                                        const Icon = item.icon;

                                        return (
                                            <li key={item.key}>
                                                <Link
                                                    href={item.href}
                                                    onClick={onNavigate}
                                                    aria-current={on ? 'page' : undefined}
                                                    title={collapsed ? item.label : undefined}
                                                    className={cn(
                                                        'flex items-center gap-2.5 transition-colors',
                                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                                        collapsed && 'justify-center',
                                                        activeClasses(on),
                                                    )}
                                                    style={{
                                                        padding: collapsed ? '8px' : 'var(--item-pad)',
                                                        fontSize: 'var(--item-font)',
                                                        borderRadius:
                                                            ACTIVE_MARK === 'pill' && on
                                                                ? '9999px'
                                                                : 'var(--item-radius)',
                                                    }}
                                                >
                                                    <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                                                    {! collapsed ? (
                                                        <>
                                                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                                            {item.count ? (
                                                                <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                                                                    {item.count}
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : null}
                        </div>
                    );
                })}
            </nav>

            <div className="shrink-0 border-t p-2" style={{ borderColor: 'var(--edge)' }}>
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    title={collapsed ? 'Expandir menú' : 'Contraer menú'}
                    aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
                    className="hidden w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-[12px] text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:flex dark:text-slate-400 dark:hover:bg-slate-700/50"
                >
                    <ChevronLeftIcon
                        className={cn('h-4 w-4 shrink-0 transition-transform', collapsed && 'rotate-180')}
                        aria-hidden="true"
                    />
                    {! collapsed ? <span>Contraer</span> : null}
                </button>
            </div>
        </div>
    );
}

export default SidebarGroups;
