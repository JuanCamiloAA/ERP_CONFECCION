import { Head, Link, router } from '@inertiajs/react';
import { CaretLeft, CaretRight, Eye, Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { WidgetCard } from '@/Components/DashboardBuilder/WidgetCard';
import { WidgetFilterBar, type WidgetFilters } from '@/Components/DashboardBuilder/WidgetFilterBar';
import { WIDGET_GRID, WidgetRow, type WidgetListRow } from '@/Components/DashboardBuilder/WidgetRow';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ListViewSwitch } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../../css/module-ui.css';

interface Metrics {
    total: number;
    active: number;
    inactive: number;
    assignments: number;
    companies: number;
    roles: number;
    unassigned: number;
}

interface Props {
    widgets: PaginatedResponse<WidgetListRow>;
    filters: WidgetFilters;
    metrics: Metrics;
    companies: { id: number; name: string }[];
}

/** Etiqueta de pagina de Laravel, sin entidades ni las palabras de navegacion. */
function pageLabel(label: string): string {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', '')
        .replace('Next', '')
        .replace('Anterior', '')
        .replace('Siguiente', '')
        .trim();
}

const COLUMNS = [
    { label: 'Widget', right: false },
    { label: 'Tipo', right: false },
    { label: 'Consulta', right: false },
    { label: 'Quién lo ve', right: false },
    { label: 'Refresco', right: true },
    { label: 'Estado', right: false },
    { label: '', right: false },
];

export default function DashboardWidgetsIndex({ widgets, filters, metrics, companies }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<WidgetListRow | null>(null);

    const rows = widgets.data;
    const total = widgets.total ?? rows.length;
    const [view, setView] = useViewMode('dashboard-widgets');

    const applyFilters = (next: WidgetFilters) => {
        const params: Record<string, string> = {};
        if (next.search) params.search = next.search;
        if (next.state !== 'all') params.state = next.state;
        if (next.type) params.type = next.type;
        if (next.assignment && next.assignment !== 'any') params.assignment = next.assignment;

        router.get(route('super-admin.dashboard-widgets.index'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const hasFilters = Boolean(
        filters.search || filters.state !== 'all' || filters.type || filters.assignment !== 'any',
    );

    const emptyState = (
        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
            {hasFilters ? (
                <>
                    Ningún widget coincide con este filtro.
                    <button
                        type="button"
                        onClick={() => applyFilters({ search: '', state: 'all', type: null, assignment: 'any' })}
                        className="ml-1 underline underline-offset-2"
                        style={{ color: 'var(--emp-accent-on)' }}
                    >
                        Limpiar filtros
                    </button>
                </>
            ) : (
                <>
                    <p>Aún no hay widgets. Crea el primero.</p>
                    <Link
                        href={route('super-admin.dashboard-widgets.create')}
                        className="emp-btn emp-btn-sm emp-btn-primary mt-3"
                    >
                        <Plus size={15} />
                        Nuevo widget
                    </Link>
                </>
            )}
        </div>
    );

    return (
        <AppLayout title="Constructor de dashboards">
            <Head title="Constructor de dashboards" />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] sm:pb-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Constructor de dashboards
                        </h1>
                        <p className="mt-1 max-w-[720px] text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Widgets dinámicos que se muestran en el Dashboard de las empresas y roles asignados. Cada
                            widget es una consulta guiada (o SQL de solo lectura) con su propia apariencia.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={route('dashboard')} className="emp-btn emp-btn-sm">
                            <Eye size={15} />
                            Ver el dashboard
                        </Link>
                        <Link
                            href={route('super-admin.dashboard-widgets.create')}
                            className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden"
                        >
                            <Plus size={15} />
                            Nuevo widget
                        </Link>
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Widgets activos</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                            {formatNumber(metrics.active)}{' '}
                            <span className="text-[15px]" style={{ color: 'var(--emp-subtle)' }}>
                                de {formatNumber(metrics.total)}
                            </span>
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {metrics.inactive === 0
                                ? 'Todos se pintan en su dashboard'
                                : `${formatNumber(metrics.inactive)} ${
                                      metrics.inactive === 1 ? 'inactivo' : 'inactivos'
                                  } · no se pintan en ningún dashboard`}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Asignaciones</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatNumber(metrics.assignments)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(metrics.companies)} {metrics.companies === 1 ? 'empresa' : 'empresas'} ·{' '}
                            {formatNumber(metrics.roles)} {metrics.roles === 1 ? 'rol distinto' : 'roles distintos'}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Sin asignar</p>
                        <p
                            className="mt-1 text-[27px] leading-none tabular-nums"
                            style={{ color: metrics.unassigned > 0 ? 'var(--emp-danger)' : 'var(--emp-text)' }}
                        >
                            {formatNumber(metrics.unassigned)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {metrics.unassigned > 0
                                ? 'Existen y están activos, pero nadie los ve'
                                : 'Todos los widgets tienen a quién mostrarse'}
                        </p>
                    </div>
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <WidgetFilterBar
                        filters={filters}
                        onChange={applyFilters}
                        companies={companies}
                        total={total}
                        unassigned={metrics.unassigned}
                        trailing={<ViewToggle variant="emp" value={view} onChange={setView} />}
                    />
                </div>

                {/* ---------------------------------------------------- listado */}
                {rows.length === 0 ? (
                    <div className="mt-4">{emptyState}</div>
                ) : (
                    <div className="mt-4">
                        <ListViewSwitch
                            view={view}
                            table={
                                <>
                                    <div
                                        className="grid items-center gap-2.5 px-3 pb-2"
                                        style={{
                                            gridTemplateColumns: WIDGET_GRID,
                                            borderBottom: '1px solid var(--emp-border)',
                                        }}
                                    >
                                        {COLUMNS.map((column, index) => (
                                            <span
                                                key={column.label || `col-${index}`}
                                                className={`text-[11px] uppercase tracking-[0.09em] ${column.right ? 'text-right' : ''}`}
                                                style={{ color: 'var(--emp-subtle)' }}
                                            >
                                                {column.label}
                                            </span>
                                        ))}
                                    </div>

                                    {rows.map((widget) => (
                                        <WidgetRow key={widget.id} widget={widget} onDelete={setConfirmDelete} />
                                    ))}
                                </>
                            }
                            cards={rows.map((widget) => (
                                <WidgetCard key={widget.id} widget={widget} onDelete={setConfirmDelete} />
                            ))}
                        />
                    </div>
                )}

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(widgets.from ?? 0)}–{formatNumber(widgets.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {widgets.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === widgets.links.length - 1;

                                return (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        aria-label={isPrev ? 'Página anterior' : isNext ? 'Página siguiente' : undefined}
                                        aria-current={link.active ? 'page' : undefined}
                                        className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-lg px-2 text-[12px] ${
                                            link.active ? 'emp-seg-on' : ''
                                        } ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        style={{
                                            border: '1px solid var(--emp-border)',
                                            color: link.active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                        }}
                                    >
                                        {isPrev ? <CaretLeft size={13} /> : isNext ? <CaretRight size={13} /> : pageLabel(link.label)}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Movil: crear siempre a mano. */}
            <div
                className="emp-form fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
            >
                <Link href={route('super-admin.dashboard-widgets.create')} className="emp-btn emp-btn-primary w-full">
                    <Plus size={17} />
                    Nuevo widget
                </Link>
            </div>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (! confirmDelete) return;
                    router.delete(route('super-admin.dashboard-widgets.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar widget"
                message={
                    confirmDelete
                        ? `Se elimina "${confirmDelete.title}" y sus ${confirmDelete.visibility_count} asignacion(es) de visibilidad por empresa y rol.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
