import { Head, Link, router, usePage } from '@inertiajs/react';
import { Camera, CaretLeft, CaretRight, DownloadSimple, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { ExpenseCard } from '@/Components/Expenses/ExpenseCard';
import {
    ExpenseFilterBar,
    type CategoryOption,
    type ExpenseFilters,
} from '@/Components/Expenses/ExpenseFilterBar';
import { ExpenseMonthGroup } from '@/Components/Expenses/ExpenseMonthGroup';
import { EXPENSE_GRID, ExpenseRow, type ExpenseRowData } from '@/Components/Expenses/ExpenseRow';
import { QuickCaptureSheet } from '@/Components/Expenses/QuickCaptureSheet';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ListViewSwitch } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { groupExpensesByMonth, monthName, variationPercent } from '@/lib/expenses';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    expenses: PaginatedResponse<ExpenseRowData>;
    categoryOptions: CategoryOption[];
    filters: ExpenseFilters;
    filteredTotal: number;
    metrics: {
        month_total: number;
        month_count: number;
        month_categories: number;
        prev_month_total: number;
        year_total: number;
        year_months: number;
    };
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

export default function ExpensesIndex({ expenses, categoryOptions, filters, filteredTotal, metrics }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [confirmDelete, setConfirmDelete] = useState<ExpenseRowData | null>(null);
    const [captureOpen, setCaptureOpen] = useState(false);

    const rows = expenses.data;
    const total = expenses.total ?? rows.length;
    const buckets = useMemo(() => groupExpensesByMonth(rows), [rows]);
    const activeCategories = useMemo(() => categoryOptions.filter((c) => c.is_active), [categoryOptions]);

    const now = new Date();
    const currentMonth = monthName(now.getMonth());
    const previousMonth = monthName((now.getMonth() + 11) % 12);
    const variation = variationPercent(metrics.month_total, metrics.prev_month_total);
    const monthlyAverage = metrics.year_months > 0 ? metrics.year_total / metrics.year_months : 0;

    const applyFilters = (next: ExpenseFilters) => {
        const params: Record<string, string> = {};
        if (next.search) params.search = next.search;
        if (next.category_id) params.category_id = String(next.category_id);
        if (next.period && next.period !== 'mes') params.period = next.period;
        if (next.date_from) params.date_from = next.date_from;
        if (next.date_to) params.date_to = next.date_to;

        router.get(route('expenses.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const hasFilters = Boolean(
        filters.search || filters.category_id || filters.period !== 'mes' || filters.date_from || filters.date_to,
    );

    /** Exportar reutiliza el filtro vigente: lo que se ve es lo que se descarga. */
    const exportUrl = useMemo(() => {
        const params: Record<string, string> = {};
        if (filters.search) params.search = filters.search;
        if (filters.category_id) params.category_id = String(filters.category_id);
        if (filters.period) params.period = filters.period;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;

        return route('expenses.export', params);
    }, [filters]);

    const metricCards = [
        {
            label: `Gasto de ${currentMonth}`,
            value: formatCurrency(metrics.month_total),
            accent: true,
            meta: `${formatNumber(metrics.month_count)} ${metrics.month_count === 1 ? 'gasto' : 'gastos'} · ${formatNumber(
                metrics.month_categories,
            )} ${metrics.month_categories === 1 ? 'categoría' : 'categorías'} con movimiento`,
        },
        {
            label: 'Mes anterior',
            value: formatCurrency(metrics.prev_month_total),
            accent: false,
            meta:
                variation === null
                    ? `Sin gastos en ${previousMonth}`
                    : `${variation > 0 ? '+' : ''}${variation}% frente a ${previousMonth}`,
        },
        {
            label: `Acumulado ${now.getFullYear()}`,
            value: formatCurrency(metrics.year_total),
            accent: false,
            meta: `Promedio mensual ${formatCurrency(monthlyAverage)} · ${formatNumber(metrics.year_months)} ${
                metrics.year_months === 1 ? 'mes' : 'meses'
            } con movimiento`,
        },
    ];

    const [view, setView] = useViewMode('expenses');

    const tableHeader = (
        <div
            className="grid items-center gap-2.5 px-3 pb-2"
            style={{ gridTemplateColumns: EXPENSE_GRID, borderBottom: '1px solid var(--emp-border)' }}
        >
            {[
                { label: 'Fecha', right: false },
                { label: 'Categoría', right: false },
                { label: 'Descripción', right: false },
                { label: 'Monto', right: true },
                { label: 'Comprobante', right: false },
                { label: 'Registró', right: false },
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
        <AppLayout title="Gastos">
            <Head title="Gastos" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Gastos
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Todo lo que sale de la caja del taller, con su comprobante. Lo que se registra aquí alimenta
                            el costo del mes.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a href={exportUrl} className="emp-btn emp-btn-sm">
                            <DownloadSimple size={15} />
                            Exportar
                        </a>
                        {!isConsolidatedView ? (
                            <Can permission="expenses.index.create">
                                <Link href={route('expenses.create')} className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden">
                                    <Plus size={15} />
                                    Registrar gasto
                                </Link>
                            </Can>
                        ) : null}
                    </div>
                </div>

                {/* Hoy los botones desaparecen sin decir por que; ahora se dice. */}
                {isConsolidatedView ? (
                    <p className="emp-note mt-4">
                        Vista consolidada de super administrador: se listan los gastos de todas las empresas y las
                        acciones de escritura quedan deshabilitadas. Selecciona una empresa en el encabezado para
                        registrar o editar.
                    </p>
                ) : null}

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
                    {metricCards.map((card) => (
                        <div key={card.label} className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 text-[27px] leading-none tabular-nums"
                                style={{ color: card.accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {card.value}
                            </p>
                            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {card.meta}
                            </p>
                        </div>
                    ))}
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <ExpenseFilterBar
                        filters={filters}
                        onChange={applyFilters}
                        categories={categoryOptions}
                        total={total}
                        filteredTotal={filteredTotal}
                        trailing={<ViewToggle variant="emp" value={view} onChange={setView} />}
                    />
                </div>

                {/* ----------------------------------------------- por mes */}
                {rows.length === 0 ? (
                    <div className="emp-card mt-4 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        No hay gastos con este filtro.
                        {hasFilters ? (
                            <button
                                type="button"
                                onClick={() =>
                                    applyFilters({
                                        search: '',
                                        category_id: null,
                                        period: 'mes',
                                        date_from: null,
                                        date_to: null,
                                    })
                                }
                                className="ml-1 underline underline-offset-2"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Limpiar filtros
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="mt-4 flex flex-col gap-[22px]">
                        {buckets.map((bucket) => (
                            <ExpenseMonthGroup key={bucket.key} bucket={bucket}>
                                <ListViewSwitch
                                    view={view}
                                    table={
                                        <>
                                            {tableHeader}
                                            {bucket.rows.map((expense) => (
                                                <ExpenseRow
                                                    key={expense.id}
                                                    expense={expense}
                                                    onDelete={setConfirmDelete}
                                                    showCompany={isConsolidatedView}
                                                    readOnly={isConsolidatedView}
                                                />
                                            ))}
                                        </>
                                    }
                                    cards={bucket.rows.map((expense) => (
                                        <ExpenseCard
                                            key={expense.id}
                                            expense={expense}
                                            onDelete={setConfirmDelete}
                                            showCompany={isConsolidatedView}
                                            readOnly={isConsolidatedView}
                                        />
                                    ))}
                                />
                            </ExpenseMonthGroup>
                        ))}
                    </div>
                )}

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(expenses.from ?? 0)}–{formatNumber(expenses.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {expenses.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === expenses.links.length - 1;

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

            {/* Movil: capturar con la foto o abrir el formulario completo. */}
            {!isConsolidatedView ? (
                <Can permission="expenses.index.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setCaptureOpen(true)}
                                disabled={activeCategories.length === 0}
                                className="emp-btn flex-1"
                            >
                                <Camera size={17} />
                                Capturar
                            </button>
                            <Link href={route('expenses.create')} className="emp-btn emp-btn-primary flex-1">
                                <Plus size={17} />
                                Registrar
                            </Link>
                        </div>
                    </div>

                    <QuickCaptureSheet
                        open={captureOpen}
                        onClose={() => setCaptureOpen(false)}
                        categories={activeCategories}
                    />
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('expenses.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Archivar gasto"
                message={
                    confirmDelete
                        ? `El gasto «${confirmDelete.description}» se archiva (eliminación suave): deja de sumar en los reportes pero queda en la auditoría con su comprobante.`
                        : ''
                }
                confirmText="Archivar"
                variant="danger"
            />
        </AppLayout>
    );
}
