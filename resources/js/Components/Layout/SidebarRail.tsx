import { Link } from '@inertiajs/react';
import { ChevronLeftIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import type { BrandLogo } from '@/Components/BrandMark';
import { SidebarBrand } from '@/Components/Layout/SidebarBrand';
import type { ActiveLocation, NavArea } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface Props {
    areas: NavArea[];
    active: ActiveLocation | null;
    /** En esta variante, colapsado = ocultar el panel y dejar solo el rail. */
    collapsed: boolean;
    onToggleCollapsed: () => void;
    onNavigate?: () => void;
    brand: {
        href: string;
        title: string;
        subtitle: string | null;
        logoUrl: string | null;
        brandLogo?: BrandLogo | null;
    };
}

/**
 * Sidebar de rail de áreas + panel de módulos (variante B).
 *
 * Pensada para quien vive dentro de un área: el rail cambia el panel **sin navegar**, así
 * que se puede mirar qué hay en Nómina sin abandonar la pantalla de Producción. La
 * navegación ocurre solo al pulsar un módulo del panel.
 */
export function SidebarRail({ areas, active, collapsed, onToggleCollapsed, onNavigate, brand }: Props) {
    const [areaKey, setAreaKey] = useState<string>(() => active?.area.key ?? areas[0]?.key ?? '');

    // Al navegar, el panel sigue a la página; mientras se explora, manda el rail.
    useEffect(() => {
        if (active?.area.key) setAreaKey(active.area.key);
    }, [active?.area.key]);

    const shown = areas.find((area) => area.key === areaKey) ?? areas[0] ?? null;

    return (
        <div className="flex h-full">
            <div
                className="flex shrink-0 flex-col items-center border-r py-2"
                style={{ width: 'var(--rail-icon-w)', backgroundColor: 'var(--rail-bg)', borderColor: 'var(--edge)' }}
            >
                <div className="mb-2 flex h-10 items-center">
                    <SidebarBrand
                        href={brand.href}
                        title={brand.title}
                        logoUrl={brand.logoUrl}
                        brandLogo={brand.brandLogo}
                        compact
                    />
                </div>

                <nav aria-label="Áreas" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                    {areas.map((area) => {
                        const on = area.key === shown?.key;
                        const Icon = area.icon;

                        return (
                            <button
                                key={area.key}
                                type="button"
                                onClick={() => setAreaKey(area.key)}
                                title={area.title}
                                aria-label={area.title}
                                aria-pressed={on}
                                className={cn(
                                    'relative flex h-11 w-10 items-center justify-center rounded-lg transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                    on
                                        ? 'bg-[var(--on-bg)] text-[var(--on-fg)]'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50',
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                {area.badge ? (
                                    <span
                                        aria-hidden="true"
                                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500"
                                    />
                                ) : null}
                            </button>
                        );
                    })}
                </nav>

                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    title={collapsed ? 'Mostrar panel' : 'Ocultar panel'}
                    aria-label={collapsed ? 'Mostrar panel' : 'Ocultar panel'}
                    aria-expanded={! collapsed}
                    className="mt-2 hidden h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:flex dark:hover:bg-slate-700/50"
                >
                    <ChevronLeftIcon
                        className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
                        aria-hidden="true"
                    />
                </button>

                <a
                    href="https://github.com/JuanCamiloAA/ERP_CONFECCION"
                    target="_blank"
                    rel="noreferrer"
                    title="Ayuda"
                    aria-label="Ayuda"
                    className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-700/50"
                >
                    <QuestionMarkCircleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </a>
            </div>

            {! collapsed && shown ? (
                <div className="flex min-w-0 flex-1 flex-col" style={{ width: 'var(--panel-w)' }}>
                    <div
                        className="flex shrink-0 items-center border-b px-3"
                        style={{ height: 'var(--bar-h)', borderColor: 'var(--edge)' }}
                    >
                        <p className="truncate text-[11px] font-medium uppercase tracking-[0.11em] text-slate-400 dark:text-slate-500">
                            {shown.title}
                        </p>
                    </div>

                    <nav aria-label="Principal" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-3">
                        <ul style={{ display: 'grid', gap: 'var(--item-gap)' }}>
                            {shown.items.map((item) => {
                                const on = active?.item.key === item.key;

                                return (
                                    <li key={item.key}>
                                        <Link
                                            href={item.href}
                                            onClick={onNavigate}
                                            aria-current={on ? 'page' : undefined}
                                            className={cn(
                                                'flex items-center gap-2 transition-colors',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                                on
                                                    ? 'bg-[var(--on-bg)] font-medium text-[var(--on-fg)] shadow-[inset_2px_0_0_var(--on-mark)]'
                                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
                                            )}
                                            style={{
                                                padding: 'var(--item-pad)',
                                                fontSize: 'var(--item-font)',
                                                borderRadius: 'var(--item-radius)',
                                            }}
                                        >
                                            {/* Sin icono a propósito: el rail ya identifica el área. */}
                                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                            {item.count ? (
                                                <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                                                    {item.count}
                                                </span>
                                            ) : null}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="shrink-0 border-t p-2" style={{ borderColor: 'var(--edge)' }}>
                        <div className="mb-1 px-1">
                            <p className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                                {brand.title}
                            </p>
                            {brand.subtitle ? (
                                <p className="truncate text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    {brand.subtitle}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default SidebarRail;
