import { Head, Link, router, usePage } from '@inertiajs/react';
import { CaretDown, CaretUp, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { cardsViewClass, tableViewClass } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { monthName } from '@/lib/expenses';
import { formatCurrency, formatNumber } from '@/lib/utils';
import '../../../../css/module-ui.css';

interface CategoryRow {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    expenses_count: number;
    month_total: number;
    company: { id: number; name: string } | null;
}

interface Props {
    categories: CategoryRow[];
    filters: { search: string; status: string };
    summary: { total: number; active: number; with_movement: number; month_total: number };
}

/** ▲▼ · Categoría · Gastos · Participación · Estado · acciones. */
const CATEGORY_GRID = '34px 1fr 92px 176px 116px 76px';

const STATUS_SEGMENTS = [
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
    { value: 'all', label: 'Todas' },
];

export default function ExpenseCategoriesIndex({ categories, filters, summary }: Props) {
    const [view, setView] = useViewMode('expense-categories');

    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [term, setTerm] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<CategoryRow | null>(null);

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

        router.get(route('expense-categories.index'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const monthLabel = monthName(new Date().getMonth());
    const grandTotal = useMemo(
        () => categories.reduce((sum, category) => sum + Number(category.month_total ?? 0), 0),
        [categories],
    );

    /** Mueve la categoria y persiste el orden completo de la lista visible. */
    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= categories.length) {
            return;
        }

        const reordered = [...categories];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(target, 0, moved);

        router.post(
            route('expense-categories.reorder'),
            { order: reordered.map((category, position) => ({ id: category.id, sort_order: position })) },
            { preserveScroll: true, preserveState: false },
        );
    };

    const toggle = (category: CategoryRow) => {
        router.patch(route('expense-categories.toggle', category.id), {}, { preserveScroll: true });
    };

    const switchControl = (category: CategoryRow, size: 'row' | 'card') => (
        <button
            type="button"
            role="switch"
            aria-checked={category.is_active}
            aria-label={`${category.is_active ? 'Desactivar' : 'Activar'} ${category.name}`}
            onClick={() => toggle(category)}
            className="flex items-center gap-2"
            style={{ minHeight: '44px' }}
        >
            <span
                aria-hidden="true"
                className="relative shrink-0 rounded-full transition-colors"
                style={{
                    width: size === 'row' ? '36px' : '40px',
                    height: size === 'row' ? '20px' : '22px',
                    backgroundColor: category.is_active ? 'var(--emp-accent)' : 'var(--emp-border)',
                }}
            >
                <span
                    className="absolute rounded-full bg-white transition-all"
                    style={{
                        width: size === 'row' ? '14px' : '16px',
                        height: size === 'row' ? '14px' : '16px',
                        top: '3px',
                        left: category.is_active ? (size === 'row' ? '19px' : '21px') : '3px',
                    }}
                />
            </span>
            <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                {category.is_active ? 'Activa' : 'Inactiva'}
            </span>
        </button>
    );

    const shareBar = (category: CategoryRow) => {
        const share = grandTotal > 0 ? Math.round((Number(category.month_total) / grandTotal) * 100) : 0;

        return (
            <div className="min-w-0">
                <div
                    aria-hidden="true"
                    className="h-[6px] w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--emp-row)' }}
                >
                    <span
                        className="block h-full rounded-full"
                        style={{ width: `${share}%`, backgroundColor: 'var(--emp-accent-line)' }}
                    />
                </div>
                <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                    {formatCurrency(category.month_total)} · {share}%
                </p>
            </div>
        );
    };

    return (
        <AppLayout title="Categorías de gastos">
            <Head title="Categorías de gastos" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Categorías de gastos
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            El catálogo con el que se clasifica cada gasto. El orden de esta lista es el orden en que
                            aparecen al registrar.
                        </p>
                    </div>

                    {!isConsolidatedView ? (
                        <Can permission="expenses.categories.create">
                            <Link
                                href={route('expense-categories.create')}
                                className="emp-btn emp-btn-sm emp-btn-primary max-sm:hidden"
                            >
                                <Plus size={15} />
                                Nueva categoría
                            </Link>
                        </Can>
                    ) : null}
                </div>

                {isConsolidatedView ? (
                    <p className="emp-note mt-4">
                        Vista consolidada de super administrador: se listan las categorías de todas las empresas y las
                        acciones de escritura quedan deshabilitadas. Selecciona una empresa en el encabezado para crear
                        o editar.
                    </p>
                ) : null}

                {/* --------------------------------------------------- resumen */}
                <div className="emp-card mt-5 grid gap-3 p-[14px_17px] sm:grid-cols-4">
                    {[
                        { label: 'Categorías', value: formatNumber(summary.total) },
                        { label: 'Activas', value: formatNumber(summary.active) },
                        { label: `Con movimiento en ${monthLabel}`, value: formatNumber(summary.with_movement) },
                        { label: `Gasto de ${monthLabel}`, value: formatCurrency(summary.month_total) },
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
                            placeholder="Buscar categoría..."
                            aria-label="Buscar categoría"
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
                        {formatNumber(categories.length)} de {formatNumber(summary.total)}{' '}
                        {summary.total === 1 ? 'categoría' : 'categorías'}
                    </span>

                    <ViewToggle variant="emp" value={view} onChange={setView} />
                </div>

                {/* ----------------------------------------------------- lista */}
                {categories.length === 0 ? (
                    <div className="emp-card mt-4 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        No hay categorías con este filtro.
                    </div>
                ) : (
                    <>
                        {/* Vista tabla. */}
                        <div className={tableViewClass(view, 'mt-4')}>
                            <div
                                className="grid items-center gap-2.5 px-3 pb-2"
                                style={{ gridTemplateColumns: CATEGORY_GRID, borderBottom: '1px solid var(--emp-border)' }}
                            >
                                {['', 'Categoría', 'Gastos', `Participación en ${monthLabel}`, 'Estado', ''].map(
                                    (label, index) => (
                                        <span
                                            key={label || `col-${index}`}
                                            className={`text-[11px] uppercase tracking-[0.09em] ${index === 2 ? 'text-right' : ''}`}
                                            style={{ color: 'var(--emp-subtle)' }}
                                        >
                                            {label}
                                        </span>
                                    ),
                                )}
                            </div>

                            {categories.map((category, index) => (
                                <div
                                    key={category.id}
                                    className={`emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5 ${
                                        category.is_active ? '' : 'emp-row-off'
                                    }`}
                                    style={{ gridTemplateColumns: CATEGORY_GRID }}
                                >
                                    <div className="flex flex-col items-center gap-0.5">
                                        {!isConsolidatedView ? (
                                            <Can permission="expenses.categories.reorder">
                                                <button
                                                    type="button"
                                                    aria-label={`Subir ${category.name}`}
                                                    disabled={index === 0}
                                                    onClick={() => move(index, -1)}
                                                    className="flex h-[18px] w-[22px] items-center justify-center rounded disabled:opacity-30"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    <CaretUp size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Bajar ${category.name}`}
                                                    disabled={index === categories.length - 1}
                                                    onClick={() => move(index, 1)}
                                                    className="flex h-[18px] w-[22px] items-center justify-center rounded disabled:opacity-30"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    <CaretDown size={12} />
                                                </button>
                                            </Can>
                                        ) : null}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                            {category.name}
                                        </p>
                                        <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {category.description ?? 'Sin descripción'}
                                            {isConsolidatedView && category.company ? ` · ${category.company.name}` : ''}
                                        </p>
                                    </div>

                                    <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatNumber(category.expenses_count)}
                                    </span>

                                    {shareBar(category)}

                                    <span>
                                        {isConsolidatedView ? (
                                            <span className="emp-pill">{category.is_active ? 'Activa' : 'Inactiva'}</span>
                                        ) : (
                                            <Can
                                                permission="expenses.categories.toggle"
                                                fallback={
                                                    <span className="emp-pill">
                                                        {category.is_active ? 'Activa' : 'Inactiva'}
                                                    </span>
                                                }
                                            >
                                                {switchControl(category, 'row')}
                                            </Can>
                                        )}
                                    </span>

                                    <div className="flex items-center justify-end gap-0.5">
                                        {!isConsolidatedView ? (
                                            <>
                                                <Can permission="expenses.categories.toggle">
                                                    <Link
                                                        href={route('expense-categories.edit', category.id)}
                                                        aria-label={`Editar ${category.name}`}
                                                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                                        style={{ color: 'var(--emp-muted)' }}
                                                    >
                                                        <PencilSimple size={15} />
                                                    </Link>
                                                </Can>
                                                <Can permission="expenses.categories.delete">
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDelete(category)}
                                                        disabled={category.expenses_count > 0}
                                                        title={
                                                            category.expenses_count > 0
                                                                ? `No se puede eliminar: hay ${category.expenses_count} gastos en esta categoría. Desactívala para que deje de aparecer.`
                                                                : 'Eliminar categoría'
                                                        }
                                                        aria-label={`Eliminar ${category.name}`}
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

                        {/* Vista tarjetas. */}
                        <div className={cardsViewClass(view, 'mt-4')}>
                            {categories.map((category) => (
                                <article
                                    key={category.id}
                                    className={`emp-card p-3 ${category.is_active ? '' : 'emp-row-off'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                                {category.name}
                                            </p>
                                            <p className="text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {category.description ?? 'Sin descripción'}
                                            </p>
                                        </div>

                                        {!isConsolidatedView ? (
                                            <Can permission="expenses.categories.toggle">
                                                <Link
                                                    href={route('expense-categories.edit', category.id)}
                                                    aria-label={`Editar ${category.name}`}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    <PencilSimple size={16} />
                                                </Link>
                                            </Can>
                                        ) : null}
                                    </div>

                                    <div className="mt-2.5">{shareBar(category)}</div>

                                    <div
                                        className="mt-2.5 flex items-center justify-between gap-2 pt-2"
                                        style={{ borderTop: '1px solid var(--emp-row)' }}
                                    >
                                        <span className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {formatNumber(category.expenses_count)}{' '}
                                            {category.expenses_count === 1 ? 'gasto' : 'gastos'}
                                        </span>
                                        {isConsolidatedView ? (
                                            <span className="emp-pill">{category.is_active ? 'Activa' : 'Inactiva'}</span>
                                        ) : (
                                            <Can
                                                permission="expenses.categories.toggle"
                                                fallback={
                                                    <span className="emp-pill">
                                                        {category.is_active ? 'Activa' : 'Inactiva'}
                                                    </span>
                                                }
                                            >
                                                {switchControl(category, 'card')}
                                            </Can>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <p className="emp-note mt-4">
                    Una categoría con gastos asociados no se puede eliminar: desactívala y deja de aparecer al registrar,
                    sin perder el histórico.
                </p>
            </div>

            {!isConsolidatedView ? (
                <Can permission="expenses.categories.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <Link href={route('expense-categories.create')} className="emp-btn emp-btn-primary w-full">
                            <Plus size={17} />
                            Nueva categoría
                        </Link>
                    </div>
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('expense-categories.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar categoría"
                message={
                    confirmDelete
                        ? `Se elimina «${confirmDelete.name}». Solo es posible porque no tiene gastos asociados; si los tuviera, habría que desactivarla.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
