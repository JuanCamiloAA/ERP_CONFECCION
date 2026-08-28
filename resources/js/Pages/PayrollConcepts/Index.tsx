import { Head, Link, router, usePage } from '@inertiajs/react';
import { MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

interface ConceptRow {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    adjustments_count: number;
    adjustments_total: number;
    last_used_at: string | null;
    company: { id: number; name: string } | null;
}

interface Props {
    concepts: ConceptRow[];
    filters: { search: string; status: string };
    summary: { total: number; active: number; year_adjustments: number; year_total: number };
}

/** Concepto · Código · Nóminas · Pagado · Último uso · Estado · acciones. */
const CONCEPT_GRID = '1fr 116px 92px 148px 104px 112px 68px';

const STATUS_SEGMENTS = [
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'all', label: 'Todos' },
];

export default function PayrollConceptsIndex({ concepts, filters, summary }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [term, setTerm] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<ConceptRow | null>(null);

    useEffect(() => {
        setTerm(filters.search ?? '');
    }, [filters.search]);

    useEffect(() => {
        if (term === (filters.search ?? '')) {
            return;
        }

        const timer = window.setTimeout(() => applyFilters({ search: term }), 300);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const applyFilters = (next: { search?: string; status?: string }) => {
        const params: Record<string, string> = {};
        const search = next.search ?? filters.search;
        const status = next.status ?? filters.status;

        if (search) params.search = search;
        if (status && status !== 'all') params.status = status;

        router.get(route('payroll-concepts.index'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const toggle = (concept: ConceptRow) => {
        router.patch(route('payroll-concepts.toggle', concept.id), {}, { preserveScroll: true });
    };

    const year = new Date().getFullYear();

    const switchControl = (concept: ConceptRow, size: 'row' | 'card') => (
        <button
            type="button"
            role="switch"
            aria-checked={concept.is_active}
            aria-label={`${concept.is_active ? 'Desactivar' : 'Activar'} ${concept.name}`}
            onClick={() => toggle(concept)}
            className="flex items-center gap-2"
            style={{ minHeight: '44px' }}
        >
            <span
                aria-hidden="true"
                className="relative shrink-0 rounded-full transition-colors"
                style={{
                    width: size === 'row' ? '36px' : '40px',
                    height: size === 'row' ? '20px' : '22px',
                    backgroundColor: concept.is_active ? 'var(--emp-accent)' : 'var(--emp-border)',
                }}
            >
                <span
                    className="absolute rounded-full bg-white transition-all"
                    style={{
                        width: size === 'row' ? '14px' : '16px',
                        height: size === 'row' ? '14px' : '16px',
                        top: '3px',
                        left: concept.is_active ? (size === 'row' ? '19px' : '21px') : '3px',
                    }}
                />
            </span>
            <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                {concept.is_active ? 'Activo' : 'Inactivo'}
            </span>
        </button>
    );

    return (
        <AppLayout title="Conceptos de nómina">
            <Head title="Conceptos de nómina" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Conceptos de nómina
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Bonificaciones y ajustes positivos que se pueden sumar a una nómina. Aquí solo se define el
                            catálogo; el valor se escribe en cada nómina.
                        </p>
                    </div>

                    {!isConsolidatedView ? (
                        <Can permission="payroll_concepts.index.create">
                            <Link
                                href={route('payroll-concepts.create')}
                                className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden"
                            >
                                <Plus size={15} />
                                Nuevo concepto
                            </Link>
                        </Can>
                    ) : null}
                </div>

                {isConsolidatedView ? (
                    <p className="emp-note mt-4">
                        Vista consolidada de super administrador: se listan los conceptos de todas las empresas y las
                        acciones de escritura quedan deshabilitadas. Selecciona una empresa en el encabezado para crear
                        o editar.
                    </p>
                ) : null}

                {/* --------------------------------------------------- resumen */}
                <div className="emp-card mt-5 grid gap-3 p-[14px_17px] sm:grid-cols-4">
                    {[
                        { label: 'Conceptos', value: formatNumber(summary.total) },
                        { label: 'Activos', value: formatNumber(summary.active) },
                        { label: `Ajustes en ${year}`, value: formatNumber(summary.year_adjustments) },
                        { label: `Pagado en ${year}`, value: formatCurrency(summary.year_total) },
                    ].map((cell) => (
                        <div key={cell.label} className="min-w-0">
                            <p className="emp-kicker">{cell.label}</p>
                            <p className="mt-0.5 text-[18px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {cell.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* --------------------------------------------------- filtros */}
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:max-w-[360px] sm:flex-1">
                        <MagnifyingGlass
                            size={15}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar concepto o código..."
                            aria-label="Buscar concepto"
                            className="emp-field pl-8"
                        />
                    </div>

                    <div className="emp-seg sm:w-[260px]">
                        {STATUS_SEGMENTS.map((segment) => (
                            <button
                                key={segment.value}
                                type="button"
                                onClick={() => applyFilters({ status: segment.value })}
                                className={`emp-seg-item ${filters.status === segment.value ? 'emp-seg-on' : ''}`}
                            >
                                {segment.label}
                            </button>
                        ))}
                    </div>

                    <span className="shrink-0 text-[12px] max-sm:hidden sm:ml-auto" style={{ color: 'var(--emp-subtle)' }}>
                        {formatNumber(concepts.length)} de {formatNumber(summary.total)}{' '}
                        {summary.total === 1 ? 'concepto' : 'conceptos'}
                    </span>
                </div>

                {/* ----------------------------------------------------- lista */}
                {concepts.length === 0 ? (
                    <div className="emp-card mt-4 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        No hay conceptos con este filtro.
                    </div>
                ) : (
                    <>
                        {/* Escritorio: tabla. */}
                        <div className="mt-4 hidden lg:block">
                            <div
                                className="grid items-center gap-2.5 px-3 pb-2"
                                style={{ gridTemplateColumns: CONCEPT_GRID, borderBottom: '1px solid var(--emp-border)' }}
                            >
                                {[
                                    { label: 'Concepto', right: false },
                                    { label: 'Código', right: false },
                                    { label: 'Nóminas', right: true },
                                    { label: `Pagado ${year}`, right: true },
                                    { label: 'Último uso', right: false },
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

                            {concepts.map((concept) => (
                                <div
                                    key={concept.id}
                                    className={`emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5 ${
                                        concept.is_active ? '' : 'emp-row-off'
                                    }`}
                                    style={{ gridTemplateColumns: CONCEPT_GRID }}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                            {concept.name}
                                        </p>
                                        <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {concept.description ?? 'Sin descripción'}
                                            {isConsolidatedView && concept.company ? ` · ${concept.company.name}` : ''}
                                        </p>
                                    </div>

                                    <span>
                                        {concept.code ? (
                                            <span className="emp-pill" style={{ fontFamily: 'ui-monospace, monospace' }}>
                                                {concept.code}
                                            </span>
                                        ) : (
                                            <span className="text-[12px]" style={{ color: 'var(--emp-faint)' }}>
                                                —
                                            </span>
                                        )}
                                    </span>

                                    <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatNumber(concept.adjustments_count)}
                                    </span>

                                    <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatCurrency(concept.adjustments_total)}
                                    </span>

                                    <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                        {concept.last_used_at ? formatDate(concept.last_used_at) : 'Nunca'}
                                    </span>

                                    <span>
                                        {isConsolidatedView ? (
                                            <span className="emp-pill">{concept.is_active ? 'Activo' : 'Inactivo'}</span>
                                        ) : (
                                            <Can
                                                permission="payroll_concepts.index.toggle"
                                                fallback={
                                                    <span className="emp-pill">
                                                        {concept.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                }
                                            >
                                                {switchControl(concept, 'row')}
                                            </Can>
                                        )}
                                    </span>

                                    <div className="flex items-center justify-end gap-0.5">
                                        {!isConsolidatedView ? (
                                            <>
                                                <Can permission="payroll_concepts.index.toggle">
                                                    <Link
                                                        href={route('payroll-concepts.edit', concept.id)}
                                                        aria-label={`Editar ${concept.name}`}
                                                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                                        style={{ color: 'var(--emp-muted)' }}
                                                    >
                                                        <PencilSimple size={15} />
                                                    </Link>
                                                </Can>
                                                <Can permission="payroll_concepts.index.delete">
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDelete(concept)}
                                                        disabled={concept.adjustments_count > 0}
                                                        title={
                                                            concept.adjustments_count > 0
                                                                ? `No se puede eliminar: el concepto tiene ${concept.adjustments_count} ajustes en nóminas. Desactívalo en su lugar.`
                                                                : 'Eliminar concepto'
                                                        }
                                                        aria-label={`Eliminar ${concept.name}`}
                                                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg disabled:opacity-35"
                                                        style={{ color: 'var(--emp-danger)' }}
                                                    >
                                                        <Trash size={15} />
                                                    </button>
                                                </Can>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Movil: tarjetas. */}
                        <div className="mt-4 flex flex-col gap-2 lg:hidden">
                            {concepts.map((concept) => (
                                <article
                                    key={concept.id}
                                    className={`emp-card p-3 ${concept.is_active ? '' : 'emp-row-off'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                                {concept.name}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                {concept.code ? (
                                                    <span
                                                        className="emp-pill"
                                                        style={{ fontFamily: 'ui-monospace, monospace' }}
                                                    >
                                                        {concept.code}
                                                    </span>
                                                ) : null}
                                                <span className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                    {formatNumber(concept.adjustments_count)}{' '}
                                                    {concept.adjustments_count === 1 ? 'nómina' : 'nóminas'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <p className="text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                {formatCurrency(concept.adjustments_total)}
                                            </p>
                                            <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {concept.last_used_at ? formatDate(concept.last_used_at) : 'Sin uso'}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        className="mt-2.5 flex items-center justify-between gap-2 pt-2"
                                        style={{ borderTop: '1px solid var(--emp-row)' }}
                                    >
                                        {isConsolidatedView ? (
                                            <span className="emp-pill">{concept.is_active ? 'Activo' : 'Inactivo'}</span>
                                        ) : (
                                            <Can
                                                permission="payroll_concepts.index.toggle"
                                                fallback={
                                                    <span className="emp-pill">
                                                        {concept.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                }
                                            >
                                                {switchControl(concept, 'card')}
                                            </Can>
                                        )}

                                        {!isConsolidatedView ? (
                                            <Can permission="payroll_concepts.index.edit">
                                                <Link
                                                    href={route('payroll-concepts.edit', concept.id)}
                                                    aria-label={`Editar ${concept.name}`}
                                                    className="flex h-11 w-11 items-center justify-center rounded-lg"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    <PencilSimple size={16} />
                                                </Link>
                                            </Can>
                                        ) : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <p className="emp-note mt-4">
                    Los conceptos son solo positivos: descuentos y anticipos viajan por su propio módulo. Desactivar un
                    concepto no cambia las nóminas ya liquidadas.
                </p>
            </div>

            {!isConsolidatedView ? (
                <Can permission="payroll_concepts.index.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <Link href={route('payroll-concepts.create')} className="emp-btn emp-btn-primary w-full">
                            <Plus size={17} />
                            Nuevo concepto
                        </Link>
                    </div>
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('payroll-concepts.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar concepto"
                message={
                    confirmDelete
                        ? `Se elimina «${confirmDelete.name}». Solo es posible porque no tiene ajustes en nóminas; si los tuviera, habría que desactivarlo.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
