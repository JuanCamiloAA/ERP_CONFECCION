import { Head, Link, router } from '@inertiajs/react';
import { CaretLeft, CaretRight, Lightning, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { OperationBulkBar } from '@/Components/Operations/OperationBulkBar';
import { OperationCard } from '@/Components/Operations/OperationCard';
import { OperationFilterBar, type OperationFilters } from '@/Components/Operations/OperationFilterBar';
import { OperationQuickCreateModal } from '@/Components/Operations/OperationQuickCreateModal';
import { OPERATION_GRID, OperationRow, type OperationRowData } from '@/Components/Operations/OperationRow';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { difficultyLabel } from '@/lib/difficulty';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    operations: PaginatedResponse<OperationRowData>;
    filters: OperationFilters;
    metrics: { avg_price: number; avg_minutes: number; active: number; avg_difficulty_level: number };
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

export default function OperationsIndex({ operations, filters, metrics }: Props) {
    const [selected, setSelected] = useState<number[]>([]);
    const [confirmDelete, setConfirmDelete] = useState<OperationRowData | null>(null);
    const [quickOpen, setQuickOpen] = useState(false);

    const rows = operations.data;
    const total = operations.total ?? rows.length;

    const pageIds = useMemo(() => rows.map((operation) => operation.id), [rows]);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
    const someSelected = pageIds.some((id) => selected.includes(id));

    const applyFilters = (next: OperationFilters) => {
        const params: Record<string, string> = {};
        if (next.search) params.search = next.search;
        if (next.status && next.status !== 'all') params.status = next.status;
        if (next.difficulty) params.difficulty = next.difficulty;

        // La seleccion es de lo que se estaba viendo; con otro filtro deja de tener sentido.
        setSelected([]);
        router.get(route('operations.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const toggleOne = (id: number) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const togglePage = () =>
        setSelected((prev) => (allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));

    const bulkStatus = (isActive: boolean) => {
        router.post(
            route('operations.bulk-status'),
            { ids: selected, is_active: isActive },
            { preserveScroll: true, onSuccess: () => setSelected([]) },
        );
    };

    const hasFilters = Boolean(filters.search || (filters.status && filters.status !== 'all') || filters.difficulty);

    const emptyState = (
        <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
            No hay operaciones con este filtro.
            {hasFilters ? (
                <button
                    type="button"
                    onClick={() => applyFilters({ search: '', status: 'all', difficulty: '' })}
                    className="ml-1 underline underline-offset-2"
                    style={{ color: 'var(--emp-accent-on)' }}
                >
                    Limpiar filtros
                </button>
            ) : null}
        </div>
    );

    return (
        <AppLayout title="Operaciones">
            <Head title="Operaciones" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Operaciones
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Catálogo del taller: lo que se paga por cada operación y la dificultad que pondera el ranking.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Can permission="operations.index.create">
                            <button type="button" onClick={() => setQuickOpen(true)} className="emp-btn emp-btn-sm">
                                <Lightning size={15} />
                                Creación rápida
                            </button>
                        </Can>
                        <Can permission="operations.index.create">
                            <Link href={route('operations.create')} className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden">
                                <Plus size={15} />
                                Nueva operación
                            </Link>
                        </Can>
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:max-w-[560px]">
                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Precio promedio</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(metrics.avg_price)}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(metrics.active)} {metrics.active === 1 ? 'operación activa' : 'operaciones activas'}
                        </p>
                    </div>

                    <div className="emp-card min-w-[212px] shrink-0 p-[17px] sm:min-w-0">
                        <p className="emp-kicker">Minutos promedio</p>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatNumber(metrics.avg_minutes)} min
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            Dificultad media del catálogo: {difficultyLabel(metrics.avg_difficulty_level)}
                        </p>
                    </div>
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <OperationFilterBar filters={filters} onChange={applyFilters} total={total} />
                </div>

                {selected.length > 0 ? (
                    <div className="mt-3">
                        <OperationBulkBar
                            count={selected.length}
                            onActivate={() => bulkStatus(true)}
                            onDeactivate={() => bulkStatus(false)}
                            onClear={() => setSelected([])}
                        />
                    </div>
                ) : null}

                {/* ------------------------------------------- movil: tarjetas */}
                <div className="mt-3 flex flex-col gap-2 lg:hidden">
                    {rows.length === 0
                        ? emptyState
                        : rows.map((operation) => (
                              <OperationCard
                                  key={operation.id}
                                  operation={operation}
                                  selected={selected.includes(operation.id)}
                                  onToggleSelect={toggleOne}
                                  onDelete={setConfirmDelete}
                              />
                          ))}
                </div>

                {/* ---------------------------------------- escritorio: tabla */}
                <div className="mt-4 hidden lg:block">
                    <div
                        className="grid items-center gap-2.5 px-3 pb-2"
                        style={{ gridTemplateColumns: OPERATION_GRID, borderBottom: '1px solid var(--emp-border)' }}
                    >
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                                // Marca «hay algo, pero no todo» en la casilla de la cabecera.
                                if (el) el.indeterminate = !allSelected && someSelected;
                            }}
                            onChange={togglePage}
                            aria-label="Seleccionar todas las operaciones de esta página"
                            className="h-4 w-4 cursor-pointer rounded"
                            style={{ accentColor: 'var(--emp-accent)' }}
                        />
                        {['Operación', 'Precio base', 'Dificultad', 'Estado', ''].map((label, index) => (
                            <span
                                key={label || `col-${index}`}
                                className={`text-[11px] uppercase tracking-[0.09em] ${index === 1 ? 'text-right' : ''}`}
                                style={{ color: 'var(--emp-subtle)' }}
                            >
                                {label}
                            </span>
                        ))}
                    </div>

                    {rows.length === 0
                        ? emptyState
                        : rows.map((operation) => (
                              <OperationRow
                                  key={operation.id}
                                  operation={operation}
                                  selected={selected.includes(operation.id)}
                                  onToggleSelect={toggleOne}
                                  onDelete={setConfirmDelete}
                              />
                          ))}
                </div>

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(operations.from ?? 0)}–{formatNumber(operations.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {operations.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === operations.links.length - 1;

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
            <Can permission="operations.index.create">
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <Link href={route('operations.create')} className="emp-btn emp-btn-primary w-full">
                        <Plus size={17} />
                        Nueva operación
                    </Link>
                </div>
            </Can>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('operations.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar operación"
                message={`¿Eliminar «${confirmDelete?.name}»? Las referencias que la usan perderán esa línea.`}
                confirmText="Eliminar"
                variant="danger"
            />

            <OperationQuickCreateModal
                open={quickOpen}
                onClose={() => setQuickOpen(false)}
                onCreated={() => {
                    setQuickOpen(false);
                    // La lista viene del servidor: se recarga para que aparezca la nueva.
                    router.reload({ only: ['operations', 'metrics'] });
                }}
            />
        </AppLayout>
    );
}
