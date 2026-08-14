import axios from 'axios';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    Bars2Icon,
    EyeIcon,
    EyeSlashIcon,
    PlusIcon,
    Squares2X2Icon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

const GridLayoutWithWidth = WidthProvider(GridLayout);

export interface DashboardPanel {
    key: string;
    node: ReactNode;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    /** Etiqueta corta para el editor movil (si falta se usa la key). */
    label?: string;
    /** Tipo, solo informativo en el editor movil ("KPI", "Grafico", "Tabla"). */
    kind?: string;
}

interface DashboardGridProps {
    variant: string;
    panels: DashboardPanel[];
    initialLayout: Layout;
    cols?: number;
    rowHeight?: number;
}

function packDefaultLayout(
    items: { key: string; w: number; h: number; minW?: number; minH?: number }[],
    cols: number,
    yOffset = 0,
): Layout {
    let x = 0;
    let y = yOffset;
    let rowH = 0;
    const layout: Layout = [];
    for (const item of items) {
        if (x + item.w > cols) {
            x = 0;
            y += rowH;
            rowH = 0;
        }
        layout.push({ i: item.key, x, y, w: item.w, h: item.h, minW: item.minW, minH: item.minH });
        x += item.w;
        rowH = Math.max(rowH, item.h);
    }
    return layout;
}

function buildLayout(panels: DashboardPanel[], saved: Layout, cols: number): Layout {
    const savedByKey = new Map(saved.map((l) => [l.i, l]));
    const kept: Layout = [];
    const missing: DashboardPanel[] = [];

    for (const p of panels) {
        const s = savedByKey.get(p.key);
        if (s) {
            kept.push({ ...s, minW: p.minW, minH: p.minH });
        } else {
            missing.push(p);
        }
    }

    const maxY = kept.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    const packedMissing = packDefaultLayout(missing, cols, kept.length > 0 ? maxY : 0);

    return [...kept, ...packedMissing];
}

/** El editor movil no arrastra: guarda orden (y), ancho (w = 6 media / 12 completa) y oculto (h = 0). */
interface MobileItem {
    key: string;
    span: 6 | 12;
    hidden: boolean;
}

function buildMobileItems(panels: DashboardPanel[], saved: Layout): MobileItem[] {
    const savedByKey = new Map(saved.map((l) => [l.i, l]));
    const known = panels
        .filter((p) => savedByKey.has(p.key))
        .sort((a, b) => (savedByKey.get(a.key)!.y ?? 0) - (savedByKey.get(b.key)!.y ?? 0))
        .map((p) => {
            const s = savedByKey.get(p.key)!;
            return { key: p.key, span: (s.w <= 6 ? 6 : 12) as 6 | 12, hidden: s.h === 0 };
        });
    const fresh = panels
        .filter((p) => !savedByKey.has(p.key))
        .map((p) => ({ key: p.key, span: (p.w <= 3 ? 6 : 12) as 6 | 12, hidden: false }));
    return [...known, ...fresh];
}

function useIsMobile(breakpoint = 1024): boolean {
    const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < breakpoint));
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [breakpoint]);
    return isMobile;
}

/**
 * Grid de paneles personalizable por usuario.
 *
 * Escritorio: react-grid-layout — mover arrastrando la barra superior, redimensionar
 * en la esquina inferior derecha (comportamiento original).
 * Movil / tablet angosta: el grid de 12 columnas no cabe, asi que cada panel ocupa el ancho
 * completo o la mitad y el editor ofrece mover arriba/abajo, cambiar ancho y ocultar. Se guarda
 * en la misma tabla con la variante sufijada ":mobile", asi el layout de escritorio no se pisa.
 */
export function DashboardGrid({ variant, panels, initialLayout, cols = 12, rowHeight = 30 }: DashboardGridProps) {
    const isMobile = useIsMobile();
    const layout = useMemo(() => buildLayout(panels, initialLayout, cols), [panels, initialLayout, cols]);
    const saveTimer = useRef<number | null>(null);
    const skipFirstSave = useRef(true);

    const [editing, setEditing] = useState(false);
    const [mobileItems, setMobileItems] = useState<MobileItem[]>(() => buildMobileItems(panels, initialLayout));

    useEffect(() => {
        setMobileItems(buildMobileItems(panels, initialLayout));
    }, [panels, initialLayout]);

    useEffect(
        () => () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
        },
        [],
    );

    const persist = useCallback(
        (newLayout: Layout, layoutVariant = variant) => {
            if (skipFirstSave.current && layoutVariant === variant) {
                skipFirstSave.current = false;
                return;
            }
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            saveTimer.current = window.setTimeout(() => {
                axios
                    .put(route('dashboard.layout.update'), {
                        variant: layoutVariant,
                        layout: newLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                    })
                    .catch(() => toast.error('No se pudo guardar la posición/tamaño. Intenta de nuevo.'));
            }, 600);
        },
        [variant],
    );

    const persistMobile = useCallback(
        (items: MobileItem[]) => {
            persist(
                items.map((item, index) => ({
                    i: item.key,
                    x: 0,
                    y: index,
                    w: item.span,
                    h: item.hidden ? 0 : 1,
                })) as Layout,
                `${variant}:mobile`,
            );
        },
        [persist, variant],
    );

    const updateMobile = (next: MobileItem[]) => {
        setMobileItems(next);
        persistMobile(next);
    };

    const move = (index: number, delta: number) => {
        const next = [...mobileItems];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        updateMobile(next);
    };

    const toggleSpan = (index: number) => {
        const next = mobileItems.map((item, i) => (i === index ? { ...item, span: (item.span === 12 ? 6 : 12) as 6 | 12 } : item));
        updateMobile(next);
    };

    const toggleHidden = (key: string) => {
        updateMobile(mobileItems.map((item) => (item.key === key ? { ...item, hidden: !item.hidden } : item)));
    };

    if (panels.length === 0) {
        return null;
    }

    const panelByKey = new Map(panels.map((p) => [p.key, p]));
    const labelOf = (key: string) => panelByKey.get(key)?.label ?? key.replace(/^(sys|custom):/, '');

    if (isMobile) {
        const visible = mobileItems.filter((item) => !item.hidden);
        const hidden = mobileItems.filter((item) => item.hidden);

        if (editing) {
            return (
                <div className="-mx-4 sm:-mx-6">
                    <div className="sticky top-16 z-20 flex h-14 items-center gap-2 bg-indigo-600 px-3 text-white">
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
                            aria-label="Salir del modo edicion"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                        <span className="flex-1 text-base font-semibold">Editando tablero</span>
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="flex h-9 items-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-indigo-700"
                        >
                            Guardar
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            Usa las flechas para cambiar el orden y el icono de ancho para que el panel ocupe media o toda la pantalla. Se
                            guarda solo para tu usuario.
                        </p>

                        {visible.map((item, index) => (
                            <div
                                key={item.key}
                                className="flex items-center gap-2.5 rounded-xl border border-dashed border-indigo-300 bg-white p-3 dark:border-indigo-500/60 dark:bg-slate-800"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                    <Squares2X2Icon className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {labelOf(item.key)}
                                    </span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        {panelByKey.get(item.key)?.kind ?? 'Panel'} · {item.span === 12 ? 'pantalla completa' : 'media pantalla'}
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center">
                                    <button
                                        type="button"
                                        onClick={() => toggleSpan(mobileItems.indexOf(item))}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                        aria-label="Cambiar ancho"
                                    >
                                        {item.span === 12 ? (
                                            <ArrowsPointingInIcon className="h-5 w-5" />
                                        ) : (
                                            <ArrowsPointingOutIcon className="h-5 w-5" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(mobileItems.indexOf(item), -1)}
                                        disabled={index === 0}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
                                        aria-label="Subir panel"
                                    >
                                        <ArrowUpIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(mobileItems.indexOf(item), 1)}
                                        disabled={index === visible.length - 1}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:text-slate-300 dark:text-slate-300 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
                                        aria-label="Bajar panel"
                                    >
                                        <ArrowDownIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggleHidden(item.key)}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                        aria-label="Ocultar panel"
                                    >
                                        <EyeSlashIcon className="h-5 w-5" />
                                    </button>
                                </span>
                            </div>
                        ))}

                        {hidden.length > 0 && (
                            <>
                                <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Ocultos
                                </p>
                                {hidden.map((item) => (
                                    <div
                                        key={item.key}
                                        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 opacity-75 dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-700">
                                            <Squares2X2Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            {labelOf(item.key)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => toggleHidden(item.key)}
                                            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                                        >
                                            <EyeIcon className="h-4 w-4" />
                                            Mostrar
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}

                        <a
                            href={route().has('super-admin.dashboard-widgets.create') ? route('super-admin.dashboard-widgets.create') : '#'}
                            className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl border border-indigo-600 text-[15px] font-semibold text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Agregar panel
                        </a>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                        <Bars2Icon className="h-4 w-4" />
                        Editar tablero
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {visible.map((item) => {
                        const panel = panelByKey.get(item.key);
                        if (!panel) return null;
                        return (
                            <div key={item.key} className={item.span === 12 ? 'col-span-2' : 'col-span-1'}>
                                {panel.node}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div>
            <style>{'html.dark .react-resizable-handle { filter: invert(1) brightness(1.7); }'}</style>
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
                Arrastra la barra superior de cada panel para moverlo; usa la esquina inferior derecha para cambiar su tamaño.
            </p>
            <GridLayoutWithWidth
                className="layout"
                layout={layout}
                cols={cols}
                rowHeight={rowHeight}
                margin={[16, 16]}
                draggableHandle=".panel-drag-handle"
                compactType="vertical"
                onLayoutChange={(l) => persist(l)}
            >
                {panels.map((p) => (
                    <div key={p.key} className="flex flex-col overflow-hidden rounded-xl">
                        <div className="panel-drag-handle flex h-5 shrink-0 cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400">
                            <Bars2Icon className="h-4 w-4" />
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">{p.node}</div>
                    </div>
                ))}
            </GridLayoutWithWidth>
        </div>
    );
}

export default DashboardGrid;
