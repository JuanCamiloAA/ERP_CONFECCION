import { Head, Link, router } from '@inertiajs/react';
import { CaretLeft, CaretRight, DownloadSimple, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { AdvanceCard } from '@/Components/Advances/AdvanceCard';
import { AdvanceFilterBar, type AdvanceFilters } from '@/Components/Advances/AdvanceFilterBar';
import { AdvanceMonthGroup, groupByMonth } from '@/Components/Advances/AdvanceMonthGroup';
import { ADVANCE_GRID, AdvanceRow, employeeName, type AdvanceRowData } from '@/Components/Advances/AdvanceRow';
import { Can } from '@/Components/UI/Can';
import { ListViewSwitch } from '@/Components/UI/ListViewSwitch';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Employee, PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    advances: PaginatedResponse<AdvanceRowData>;
    filters: AdvanceFilters;
    employees: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
    metrics: {
        pending_total: number;
        pending_count: number;
        pending_employees: number;
        month_total: number;
        prev_month_total: number;
        year_discounted: number;
        year_closed_count: number;
        next_payroll_date: string | null;
    };
}

const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

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

export default function AdvancesIndex({ advances, filters, employees, metrics }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<AdvanceRowData | null>(null);

    const rows = advances.data;
    const total = advances.total ?? rows.length;
    const buckets = useMemo(() => groupByMonth(rows), [rows]);

    const applyFilters = (next: AdvanceFilters) => {
        const params: Record<string, string> = {};
        if (next.search) params.search = next.search;
        if (next.balance && next.balance !== 'with') params.balance = next.balance;
        if (next.employee_id) params.employee_id = String(next.employee_id);

        router.get(route('advances.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const hasFilters = Boolean(filters.search || filters.balance !== 'with' || filters.employee_id);
    const monthName = MONTH_NAMES[new Date().getMonth()] ?? '';

    /** Exportar reutiliza el filtro vigente: lo que se ve es lo que se descarga. */
    const exportUrl = useMemo(() => {
        const params: Record<string, string> = {};
        if (filters.search) params.search = filters.search;
        if (filters.balance) params.balance = filters.balance;
        if (filters.employee_id) params.employee_id = String(filters.employee_id);

        return route('advances.export', params);
    }, [filters]);

    const emptyState = (
        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
            No hay anticipos con este filtro.
            {hasFilters ? (
                <button
                    type="button"
                    onClick={() => applyFilters({ search: '', balance: 'all', employee_id: null })}
                    className="ml-1 underline underline-offset-2"
                    style={{ color: 'var(--emp-accent-on)' }}
                >
                    Limpiar filtros
                </button>
            ) : null}
        </div>
    );

    const [view, setView] = useViewMode('advances');

    const tableHeader = (
        <div
            className="grid items-center gap-2.5 px-3 pb-2"
            style={{ gridTemplateColumns: ADVANCE_GRID, borderBottom: '1px solid var(--emp-border)' }}
        >
            {[
                { label: 'Fecha', right: false },
                { label: 'Empleado', right: false },
                { label: 'Motivo', right: false },
                { label: 'Monto', right: true },
                { label: 'Saldo por descontar', right: false },
                { label: 'Estado', right: false },
                { label: '', right: false },
            ].map((column, index) => (
                <span
                    key={column.label || `col-${index}`}
                    className={`text-[11px] uppercase tracking-[0.09em] ${column.right ? 'text-right' : ''}`}
                    style={{ color: 'var(--emp-subtle)' }}
                >
                    {column.label}
                </span>
            ))}
        </div>
    );

    return (
        <AppLayout title="Anticipos">
            <Head title="Anticipos" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Anticipos
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Dinero entregado antes de la nómina. Lo que queda por descontar viaja al siguiente periodo.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a href={exportUrl} className="emp-btn emp-btn-sm">
                            <DownloadSimple size={15} />
                            Exportar
                        </a>
                        <Can permission="advances.index.create">
                            <Link href={route('advances.create')} className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden">
                                <Plus size={15} />
                                Nuevo anticipo
                            </Link>
                        </Can>
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Saldo por descontar</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                            {formatCurrency(metrics.pending_total)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(metrics.pending_count)}{' '}
                            {metrics.pending_count === 1 ? 'anticipo' : 'anticipos'} ·{' '}
                            {formatNumber(metrics.pending_employees)}{' '}
                            {metrics.pending_employees === 1 ? 'empleado' : 'empleados'}
                            {metrics.next_payroll_date
                                ? ` · sale en la nómina del ${formatDate(metrics.next_payroll_date)}`
                                : ' · sin nómina abierta todavía'}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Entregado en {monthName}</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(metrics.month_total)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mes anterior: {formatCurrency(metrics.prev_month_total)}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Descontado en el año</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(metrics.year_discounted)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(metrics.year_closed_count)}{' '}
                            {metrics.year_closed_count === 1 ? 'anticipo cerrado' : 'anticipos cerrados'}
                        </p>
                    </div>
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <AdvanceFilterBar
                        filters={filters}
                        onChange={applyFilters}
                        employees={employees}
                        total={total}
                        pendingCount={metrics.pending_count}
                        trailing={<ViewToggle variant="emp" value={view} onChange={setView} />}
                    />
                </div>

                {/* --------------------------------------------- por mes */}
                {rows.length === 0 ? (
                    <div className="mt-4">{emptyState}</div>
                ) : (
                    <div className="mt-4 flex flex-col gap-[22px]">
                        {buckets.map((bucket) => (
                            <AdvanceMonthGroup key={bucket.key} bucket={bucket}>
                                <ListViewSwitch
                                    view={view}
                                    table={
                                        <>
                                            {tableHeader}
                                            {bucket.rows.map((advance) => (
                                                <AdvanceRow
                                                    key={advance.id}
                                                    advance={advance}
                                                    onDelete={setConfirmDelete}
                                                />
                                            ))}
                                        </>
                                    }
                                    cards={bucket.rows.map((advance) => (
                                        <AdvanceCard key={advance.id} advance={advance} onDelete={setConfirmDelete} />
                                    ))}
                                />
                            </AdvanceMonthGroup>
                        ))}
                    </div>
                )}

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(advances.from ?? 0)}–{formatNumber(advances.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {advances.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === advances.links.length - 1;

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

            {/* Movil: registrar siempre a mano. */}
            <Can permission="advances.index.create">
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <Link href={route('advances.create')} className="emp-btn emp-btn-primary w-full">
                        <Plus size={17} />
                        Nuevo anticipo
                    </Link>
                </div>
            </Can>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('advances.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar anticipo"
                message={
                    confirmDelete
                        ? `Se elimina el anticipo de ${employeeName(confirmDelete)} por ${formatCurrency(
                              confirmDelete.amount,
                          )}. Solo es posible porque todavía no tiene descuentos aplicados.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
