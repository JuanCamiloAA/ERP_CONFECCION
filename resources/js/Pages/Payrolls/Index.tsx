import { Head, Link, router, usePage } from '@inertiajs/react';
import { CaretLeft, CaretRight, DownloadSimple, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { PayrollCard } from '@/Components/Payrolls/PayrollCard';
import { PayrollFilterBar, type PayrollFilters } from '@/Components/Payrolls/PayrollFilterBar';
import { PayrollMonthGroup } from '@/Components/Payrolls/PayrollMonthGroup';
import { PAYROLL_GRID, PayrollRow, type PayrollRowData } from '@/Components/Payrolls/PayrollRow';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { groupPayrollsByMonth, isClosed } from '@/lib/payrolls';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Metrics {
    open_net: number;
    open_employees: number;
    open_status: string | null;
    open_period_end: string | null;
    open_type: string | null;
    year_paid: number;
    year_closed_count: number;
    year_approved_unpaid: number;
    average_per_employee: number;
    filtered_open_count: number;
}

interface Props {
    payrolls: PaginatedResponse<PayrollRowData>;
    filters: PayrollFilters;
    metrics: Metrics;
    periodicities: { code: string; name: string }[];
    years: number[];
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
    { label: 'Periodo', right: false },
    { label: 'Nómina', right: false },
    { label: 'Empleados', right: true },
    { label: 'Flujo', right: false },
    { label: 'Neto', right: true },
    { label: 'Estado', right: false },
    { label: '', right: false },
];

export default function PayrollsIndex({ payrolls, filters, metrics, periodicities, years }: Props) {
    const page = usePage<App.PageProps>();
    const isConsolidatedView = page.props.isConsolidatedView ?? false;
    const [confirmDelete, setConfirmDelete] = useState<PayrollRowData | null>(null);

    const rows = payrolls.data;
    const total = payrolls.total ?? rows.length;
    const buckets = useMemo(() => groupPayrollsByMonth(rows), [rows]);

    /** La nomina abierta mas reciente: el listado viene ordenado por periodo descendente. */
    const highlightId = useMemo(() => rows.find((row) => ! isClosed(row.status))?.id ?? null, [rows]);

    const applyFilters = (next: PayrollFilters) => {
        const params: Record<string, string | number> = { year: next.year };
        if (next.search) params.search = next.search;
        if (next.state !== 'open') params.state = next.state;
        if (next.type) params.type = next.type;

        router.get(route('payrolls.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const hasFilters = Boolean(filters.search || filters.state !== 'open' || filters.type);

    const exportUrl = useMemo(() => {
        const params: Record<string, string | number> = { year: filters.year };
        if (filters.search) params.search = filters.search;
        if (filters.state) params.state = filters.state;
        if (filters.type) params.type = filters.type;

        return route('payrolls.export-list', params);
    }, [filters]);

    const openMeta = metrics.open_status
        ? `${formatNumber(metrics.open_employees)} ${metrics.open_employees === 1 ? 'empleado' : 'empleados'} · ${
              metrics.open_status
          }${metrics.open_period_end ? ` · cierra el ${formatDate(metrics.open_period_end)}` : ''}`
        : 'Sin nómina abierta todavía';

    const emptyState = (
        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
            No hay nóminas con este filtro.
            {hasFilters ? (
                <button
                    type="button"
                    onClick={() => applyFilters({ search: '', state: 'all', year: filters.year, type: null })}
                    className="ml-1 underline underline-offset-2"
                    style={{ color: 'var(--emp-accent-on)' }}
                >
                    Limpiar filtros
                </button>
            ) : null}
        </div>
    );

    const tableHeader = (
        <div
            className="grid items-center gap-2.5 px-3 pb-2"
            style={{ gridTemplateColumns: PAYROLL_GRID, borderBottom: '1px solid var(--emp-border)' }}
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
    );

    return (
        <AppLayout title="Nómina">
            <Head title="Nómina" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Nómina
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Periodos de liquidación de la empresa. Producido, jornada, recargos, anticipos y conceptos
                            manuales se cierran aquí.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a href={exportUrl} className="emp-btn emp-btn-sm">
                            <DownloadSimple size={15} />
                            Exportar
                        </a>
                        {! isConsolidatedView ? (
                            <Can permission="payrolls.index.create">
                                <Link
                                    href={route('payrolls.create')}
                                    className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden"
                                >
                                    <Plus size={15} />
                                    Nueva nómina
                                </Link>
                            </Can>
                        ) : null}
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Neto del periodo abierto</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                            {formatCurrency(metrics.open_net)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {openMeta}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Pagado en {filters.year}</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(metrics.year_paid)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(metrics.year_closed_count)}{' '}
                            {metrics.year_closed_count === 1 ? 'nómina cerrada' : 'nóminas cerradas'} ·{' '}
                            {formatNumber(metrics.year_approved_unpaid)}{' '}
                            {metrics.year_approved_unpaid === 1 ? 'aprobada sin pagar' : 'aprobadas sin pagar'}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Promedio por empleado</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(metrics.average_per_employee)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {metrics.open_status
                                ? `Periodo abierto · ${metrics.open_type ?? ''}`.trim()
                                : 'Sin periodo abierto que promediar'}
                        </p>
                    </div>
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <PayrollFilterBar
                        filters={filters}
                        onChange={applyFilters}
                        periodicities={periodicities}
                        years={years}
                        total={total}
                        openCount={metrics.filtered_open_count}
                    />
                </div>

                {/* ---------------------------------------------------- por mes */}
                {rows.length === 0 ? (
                    <div className="mt-4">{emptyState}</div>
                ) : (
                    <div className="mt-4 flex flex-col gap-[22px]">
                        {buckets.map((bucket) => (
                            <PayrollMonthGroup key={bucket.key} bucket={bucket}>
                                {/* Escritorio: tabla. */}
                                <div className="hidden lg:block">
                                    {tableHeader}
                                    {bucket.rows.map((payroll) => (
                                        <PayrollRow
                                            key={payroll.id}
                                            payroll={payroll}
                                            onDelete={setConfirmDelete}
                                            highlighted={payroll.id === highlightId}
                                            showCompany={isConsolidatedView}
                                        />
                                    ))}
                                </div>

                                {/* Movil: tarjetas. */}
                                <div className="flex flex-col gap-2 lg:hidden">
                                    {bucket.rows.map((payroll) => (
                                        <PayrollCard
                                            key={payroll.id}
                                            payroll={payroll}
                                            onDelete={setConfirmDelete}
                                            showCompany={isConsolidatedView}
                                        />
                                    ))}
                                </div>
                            </PayrollMonthGroup>
                        ))}
                    </div>
                )}

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(payrolls.from ?? 0)}–{formatNumber(payrolls.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {payrolls.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === payrolls.links.length - 1;

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
            {! isConsolidatedView ? (
                <Can permission="payrolls.index.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <Link href={route('payrolls.create')} className="emp-btn emp-btn-primary w-full">
                            <Plus size={17} />
                            Nueva nómina
                        </Link>
                    </div>
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('payrolls.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title={confirmDelete && isClosed(confirmDelete.status) ? 'Eliminar y revertir el cierre' : 'Eliminar nómina'}
                variant={confirmDelete && isClosed(confirmDelete.status) ? 'danger' : undefined}
                confirmText={confirmDelete && isClosed(confirmDelete.status) ? 'Eliminar y revertir' : undefined}
                message={
                    confirmDelete && isClosed(confirmDelete.status)
                        ? `La nomina "${confirmDelete.name}" esta ${confirmDelete.status}. Al eliminarla se deshace el cierre: la produccion liquidada vuelve al estado que tenia y los anticipos recuperan su saldo, de modo que puedas generar el periodo de nuevo desde cero. Queda registro de quien lo hizo.`
                        : `Eliminar la nomina "${confirmDelete?.name}"?`
                }
            />
        </AppLayout>
    );
}
