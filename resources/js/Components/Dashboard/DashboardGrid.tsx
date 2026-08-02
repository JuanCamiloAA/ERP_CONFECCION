import axios from 'axios';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Bars2Icon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';

const GridLayoutWithWidth = WidthProvider(GridLayout);

export interface DashboardPanel {
    key: string;
    node: ReactNode;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
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

/**
 * Combina el layout guardado por el usuario (si existe) con los paneles actuales:
 * - Paneles ya conocidos conservan su x/y/w/h guardados (min W/H se refresca por si cambio el default).
 * - Paneles nuevos (widgets recien creados) se acomodan al final, en orden.
 * - Paneles guardados que ya no existen (ej. widget eliminado) simplemente se ignoran.
 */
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

/**
 * Grid de paneles que el usuario puede mover (arrastrando la barra superior) y
 * redimensionar (arrastrando la esquina inferior derecha), tanto KPIs como graficos,
 * tablas y listas. El layout se guarda por usuario (ver DashboardLayoutController),
 * no afecta a otros usuarios de la misma empresa/rol.
 */
export function DashboardGrid({ variant, panels, initialLayout, cols = 12, rowHeight = 30 }: DashboardGridProps) {
    const layout = useMemo(() => buildLayout(panels, initialLayout, cols), [panels, initialLayout, cols]);
    const saveTimer = useRef<number | null>(null);
    const skipFirstSave = useRef(true);

    useEffect(
        () => () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
        },
        [],
    );

    const persist = useCallback(
        (newLayout: Layout) => {
            if (skipFirstSave.current) {
                skipFirstSave.current = false;
                return;
            }
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            saveTimer.current = window.setTimeout(() => {
                axios
                    .put(route('dashboard.layout.update'), {
                        variant,
                        layout: newLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
                    })
                    .catch(() => toast.error('No se pudo guardar la posición/tamaño. Intenta de nuevo.'));
            }, 600);
        },
        [variant],
    );

    if (panels.length === 0) {
        return null;
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
                onLayoutChange={persist}
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
