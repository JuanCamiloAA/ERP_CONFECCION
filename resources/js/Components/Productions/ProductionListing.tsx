import { Link, router, usePage } from '@inertiajs/react';
import { CaretDown, ListBullets, Rows } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { ProductionDayGroup, groupByDay, longDayLabel, type DayBucket } from '@/Components/Productions/ProductionDayGroup';
import {
    ProductionFilterBar,
    type FilterChip,
    type ProductionFilterKey,
    type ProductionFilterState,
} from '@/Components/Productions/ProductionFilterBar';
import { ProductionRecordCard } from '@/Components/Productions/ProductionRecordCard';
import { ProductionRow, ProductionTable, ProductionTableHeader } from '@/Components/Productions/ProductionTable';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { cardsViewClass, tableViewClass } from '@/Components/UI/ListViewSwitch';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useViewMode } from '@/hooks/useViewMode';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Employee, Operation, PaginatedResponse, Production, Reference } from '@/types';

/**
 * Que parte de la produccion muestra el listado.
 *
 * `all` es el listado general de administracion. El Detalle (`unpaid`) y el Historial
 * (`paid`) parten los mismos registros por el pago: lo que aun puede entrar en una nomina
 * y lo que ya se pago. El servidor aplica el corte; aqui solo cambian los textos y los
 * filtros que tienen sentido en cada lado.
 */
export type ProductionScope = 'all' | 'unpaid' | 'paid';

export interface ProductionListingFilters {
    employee_id: number | null;
    reference_id: number | null;
    operation_id: number | null;
    date_start: string | null;
    date_end: string | null;
    shift: string | null;
    status: string | null;
}

export interface ProductionListingTotals {
    total_quantity: number;
    total_value: number;
    pending_count?: number;
}

export interface ProductionListingProps {
    productions: PaginatedResponse<Production>;
    filters: ProductionListingFilters;
    totals: ProductionListingTotals;
    employees: Employee[];
    references: Reference[];
    operations: Operation[];
    workerMode?: boolean;
    scope?: ProductionScope;
}

type FilterKey = ProductionFilterKey;
type FilterState = ProductionFilterState;

const ROUTE_BY_SCOPE: Record<ProductionScope, string> = {
    all: 'productions.index',
    unpaid: 'productions.detail',
    paid: 'productions.history',
};

const SHIFT_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };
const STATUS_LABEL: Record<string, string> = { pendiente: 'Pendiente', confirmado: 'Confirmado', pagado: 'Pagado' };

/** En el Historial todo es «pagado»: el filtro de estado no tiene nada que elegir. */
const STATUS_OPTIONS: Record<ProductionScope, { value: string; label: string }[]> = {
    all: [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'confirmado', label: 'Confirmado' },
        { value: 'pagado', label: 'Pagado' },
    ],
    unpaid: [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'confirmado', label: 'Confirmado' },
    ],
    paid: [],
};

const VALUE_LABEL: Record<ProductionScope, string> = {
    all: 'Valor del periodo',
    unpaid: 'Valor sin pagar',
    paid: 'Valor pagado',
};

const EMPTY_LABEL: Record<ProductionScope, string> = {
    all: 'No hay registros con este filtro.',
    unpaid: 'No hay producción pendiente de pago.',
    paid: 'Todavía no hay producción pagada.',
};

const VIEW_MODE_STORAGE_KEY = 'productions-index:view-mode';
type ViewMode = 'list' | 'day';

const emptyFilters: FilterState = {
    employee_id: '',
    reference_id: '',
    operation_id: '',
    date_start: '',
    date_end: '',
    shift: '',
    status: '',
};

/**
 * Metricas, barra de filtros y registros (tabla o tarjetas), con su paginacion y los
 * dialogos de eliminar y confirmar el dia.
 */
export function ProductionListing({
    productions,
    filters,
    totals,
    employees,
    references,
    operations,
    workerMode = false,
    scope = 'all',
}: ProductionListingProps) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const perms = usePermissions();
    const routeName = ROUTE_BY_SCOPE[scope];
    const statusOptions = STATUS_OPTIONS[scope];

    const [localFilters, setLocalFilters] = useState<FilterState>({
        employee_id: filters.employee_id ? String(filters.employee_id) : '',
        reference_id: filters.reference_id ? String(filters.reference_id) : '',
        operation_id: filters.operation_id ? String(filters.operation_id) : '',
        date_start: filters.date_start ?? '',
        date_end: filters.date_end ?? '',
        shift: filters.shift ?? '',
        status: filters.status ?? '',
    });
    const [confirmDelete, setConfirmDelete] = useState<Production | null>(null);
    const [confirmDay, setConfirmDay] = useState<DayBucket | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // La preferencia de vista se lee despues del montaje: en el primer render del
    // servidor no hay `localStorage` y leerlo ahi rompe la hidratacion.
    useEffect(() => {
        const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
        if (stored === 'day' || stored === 'list') {
            setViewMode(stored);
        }
    }, []);

    const chooseView = (mode: ViewMode) => {
        setViewMode(mode);
        window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    };

    const apply = (next: FilterState = localFilters) => {
        const params: Record<string, string> = {};
        (Object.entries(next) as [FilterKey, string][]).forEach(([k, v]) => {
            if (v) params[k] = v;
        });
        setLocalFilters(next);
        router.get(route(routeName), params, { preserveState: true, replace: true });
    };

    const reset = () => {
        setLocalFilters(emptyFilters);
        router.get(route(routeName), {}, { preserveState: true, replace: true });
    };

    /** Quita un filtro puntual desde su chip y recarga de inmediato. */
    const clearFilter = (key: string) => {
        apply({ ...localFilters, [key]: '' });
    };

    /* --------------------------------------------------------------- acciones */

    const confirmOne = (production: Production) => {
        router.post(route('productions.confirm', production.id), {}, { preserveScroll: true, preserveState: false });
    };

    const confirmWholeDay = () => {
        if (!confirmDay) return;

        router.post(
            route('productions.confirm-day'),
            {
                date: confirmDay.date,
                // Si el listado esta filtrado por una persona, se confirma solo lo suyo:
                // es lo que el usuario esta viendo y lo unico que reviso.
                employee_id: localFilters.employee_id ? Number(localFilters.employee_id) : null,
            },
            { preserveScroll: true, onFinish: () => setConfirmDay(null) },
        );
    };

    /* ---------------------------------------------------------------- chips */

    const activeChips: FilterChip[] = [];
    if (localFilters.employee_id) {
        const e = employees.find((x) => String(x.id) === localFilters.employee_id);
        activeChips.push({
            key: 'employee_id',
            label: e ? (e.full_name ?? `${e.first_name} ${e.last_name}`) : 'Empleado',
        });
    }
    if (localFilters.reference_id) {
        const r = references.find((x) => String(x.id) === localFilters.reference_id);
        activeChips.push({ key: 'reference_id', label: r ? r.code : 'Referencia' });
    }
    if (localFilters.operation_id) {
        const o = operations.find((x) => String(x.id) === localFilters.operation_id);
        activeChips.push({ key: 'operation_id', label: o ? o.name : 'Operación' });
    }
    if (localFilters.date_start) activeChips.push({ key: 'date_start', label: `Desde ${formatDate(localFilters.date_start)}` });
    if (localFilters.date_end) activeChips.push({ key: 'date_end', label: `Hasta ${formatDate(localFilters.date_end)}` });
    if (localFilters.shift) activeChips.push({ key: 'shift', label: SHIFT_LABEL[localFilters.shift] ?? localFilters.shift });
    if (localFilters.status) activeChips.push({ key: 'status', label: STATUS_LABEL[localFilters.status] ?? localFilters.status });

    const statusField =
        statusOptions.length > 0 ? (
            <FilterSelect
                label="Estado"
                value={localFilters.status}
                onChange={(v) => apply({ ...localFilters, status: v })}
                placeholder="Todos"
                options={statusOptions}
            />
        ) : null;

    const workerColumns = statusField ? 'lg:grid-cols-5' : 'lg:grid-cols-4';

    /** Los mismos campos de siempre; viven dentro del panel «Más filtros». */
    const filterFields = (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${workerMode ? workerColumns : 'lg:grid-cols-3'}`}>
            {!workerMode && (
                <FilterSelect
                    label="Empleado"
                    value={localFilters.employee_id}
                    onChange={(v) => apply({ ...localFilters, employee_id: v })}
                    placeholder="Todos"
                    options={employees.map((e) => ({
                        value: String(e.id),
                        label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                    }))}
                />
            )}
            <FilterSelect
                label="Referencia"
                value={localFilters.reference_id}
                onChange={(v) => apply({ ...localFilters, reference_id: v })}
                placeholder="Todas"
                options={references.map((r) => ({ value: String(r.id), label: `${r.code} - ${r.name}` }))}
            />
            <FilterSelect
                label="Operación"
                value={localFilters.operation_id}
                onChange={(v) => apply({ ...localFilters, operation_id: v })}
                placeholder="Todas"
                options={operations.map((o) => ({ value: String(o.id), label: o.name }))}
            />
            <FilterDate
                label="Desde"
                value={localFilters.date_start}
                onChange={(v) => apply({ ...localFilters, date_start: v })}
            />
            <FilterDate label="Hasta" value={localFilters.date_end} onChange={(v) => apply({ ...localFilters, date_end: v })} />
            {workerMode ? (
                statusField
            ) : (
                <>
                    <FilterSelect
                        label="Turno"
                        value={localFilters.shift}
                        onChange={(v) => apply({ ...localFilters, shift: v })}
                        placeholder="Todos"
                        options={[
                            { value: 'manana', label: 'Mañana' },
                            { value: 'tarde', label: 'Tarde' },
                            { value: 'noche', label: 'Noche' },
                        ]}
                    />
                    {statusField}
                </>
            )}
        </div>
    );

    /* ------------------------------------------------------------- derivados */

    const rows = productions.data;
    const buckets = useMemo(() => groupByDay(rows), [rows]);
    const total = productions.total ?? rows.length;
    const pending = totals.pending_count ?? 0;

    /** El año solo aparece cuando el filtro cruza dos años; si no, es ruido. */
    const showYear = useMemo(() => {
        const years = new Set(rows.map((r) => String(r.date).slice(0, 4)));

        return years.size > 1;
    }, [rows]);

    const exportUrl = useMemo(() => {
        const params: Record<string, string> = {};
        (Object.entries(localFilters) as [FilterKey, string][]).forEach(([k, v]) => {
            if (v) params[k] = v;
        });
        // El Detalle y el Historial exportan solo su lado del pago.
        if (scope !== 'all') params.scope = scope;

        return route('productions.export', params);
    }, [localFilters, scope]);

    const nextPageUrl = productions.links.find((l, i) => i === productions.links.length - 1)?.url ?? null;

    const [view, setView] = useViewMode('productions');

    const viewSwitch = (
        <div className={`emp-seg shrink-0 max-lg:hidden ${view === 'cards' ? 'hidden' : ''}`}>
            <button
                type="button"
                onClick={() => chooseView('list')}
                className={`emp-seg-item ${viewMode === 'list' ? 'emp-seg-on' : ''}`}
            >
                <ListBullets size={13} className="mr-1 inline align-[-2px]" />
                Lista
            </button>
            <button
                type="button"
                onClick={() => chooseView('day')}
                className={`emp-seg-item ${viewMode === 'day' ? 'emp-seg-on' : ''}`}
            >
                <Rows size={13} className="mr-1 inline align-[-2px]" />
                Por día
            </button>
        </div>
    );

    const emptyState = (
        <div className="px-[17px] py-12 text-center">
            <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                {activeChips.length > 0 ? 'No hay registros con este filtro.' : EMPTY_LABEL[scope]}
            </p>
            {activeChips.length > 0 ? (
                <button
                    type="button"
                    onClick={reset}
                    className="mt-1.5 text-[12px] underline underline-offset-2"
                    style={{ color: 'var(--emp-accent-on)' }}
                >
                    Limpiar filtros
                </button>
            ) : null}
        </div>
    );

    /* ------------------------------------------------------------------ render */

    return (
        <>
            {/* -------------------------------------------------- metricas */}
            <div
                className={`mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 ${
                    scope === 'paid' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
                }`}
            >
                <Metric label={VALUE_LABEL[scope]} value={formatCurrency(totals.total_value)} />
                <Metric label="Unidades" value={formatNumber(totals.total_quantity)} />
                <Metric label="Registros" value={formatNumber(total)} className="max-sm:hidden" />
                {/* Lo pagado ya no espera confirmacion: la metrica seria siempre cero. */}
                {scope === 'paid' ? null : <Metric label="Por confirmar" value={formatNumber(pending)} accent={pending > 0} />}
            </div>

            {/* --------------------------------------------------- filtros */}
            <div className="mt-4">
                <ProductionFilterBar
                    filters={localFilters}
                    onApply={apply}
                    onClearFilter={clearFilter}
                    onReset={reset}
                    chips={activeChips}
                    fields={filterFields}
                    employees={employees}
                    references={references}
                    operations={operations}
                    // La ruta de exportar exige su permiso: sin el, el boton solo llevaria a un 403.
                    exportUrl={perms.can('productions.index.export') ? exportUrl : undefined}
                    viewSwitch={viewSwitch}
                    trailing={<ViewToggle variant="emp" value={view} onChange={setView} />}
                />
            </div>

            {/* ------------------------------------- vista tarjetas: por dia */}
            <div className={cardsViewClass(view, 'mt-4 gap-4')}>
                {rows.length === 0 ? <div className="emp-card">{emptyState}</div> : null}

                {buckets.map((bucket) => (
                    <section key={bucket.date}>
                        <div className="flex items-baseline justify-between gap-2 px-0.5 pb-1.5">
                            <h2 className="truncate text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                                {longDayLabel(bucket.date)}
                            </h2>
                            <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                {formatCurrency(bucket.value)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {bucket.rows.map((p) => (
                                <ProductionRecordCard
                                    key={p.id}
                                    production={p}
                                    showCompany={isConsolidatedView}
                                    onConfirm={confirmOne}
                                    onDelete={setConfirmDelete}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            {/* ------------------------------------------------- vista tabla */}
            <div className={tableViewClass(view, 'mt-4')}>
                {viewMode === 'list' ? (
                    <ProductionTable totalQuantity={totals.total_quantity} totalValue={totals.total_value}>
                        <ProductionTableHeader />
                        {rows.length === 0
                            ? emptyState
                            : rows.map((p) => (
                                  <ProductionRow
                                      key={p.id}
                                      production={p}
                                      showYear={showYear}
                                      showCompany={isConsolidatedView}
                                      onConfirm={confirmOne}
                                      onDelete={setConfirmDelete}
                                  />
                              ))}
                    </ProductionTable>
                ) : (
                    <ProductionTable grouped totalQuantity={totals.total_quantity} totalValue={totals.total_value}>
                        {rows.length === 0 ? emptyState : null}
                        {buckets.map((bucket) => (
                            <ProductionDayGroup key={bucket.date} bucket={bucket} onConfirmDay={setConfirmDay}>
                                <ProductionTableHeader grouped />
                                {bucket.rows.map((p) => (
                                    <ProductionRow
                                        key={p.id}
                                        production={p}
                                        grouped
                                        showCompany={isConsolidatedView}
                                        onConfirm={confirmOne}
                                        onDelete={setConfirmDelete}
                                    />
                                ))}
                            </ProductionDayGroup>
                        ))}
                    </ProductionTable>
                )}
            </div>

            {/* ------------------------------------------------ paginacion */}
            {rows.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {formatNumber(total)} {total === 1 ? 'registro' : 'registros'} en el filtro
                        {viewMode === 'list' ? (
                            <span>
                                {' '}
                                · viendo {formatNumber(productions.from ?? 0)}–{formatNumber(productions.to ?? 0)}
                            </span>
                        ) : null}
                    </p>

                    {nextPageUrl ? (
                        <Link href={nextPageUrl} preserveScroll className="emp-btn emp-btn-sm">
                            {viewMode === 'day' ? 'Cargar días anteriores' : 'Siguiente página'}
                        </Link>
                    ) : null}
                </div>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('productions.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar registro de producción"
                message="Esta acción no se puede deshacer."
                variant="danger"
            />

            <ConfirmDialog
                open={!!confirmDay}
                onClose={() => setConfirmDay(null)}
                onConfirm={confirmWholeDay}
                title="Confirmar el día"
                message={
                    confirmDay
                        ? `Se confirmarán ${confirmDay.pending} ${
                              confirmDay.pending === 1 ? 'registro pendiente' : 'registros pendientes'
                          } del ${longDayLabel(confirmDay.date).toLowerCase()}${
                              localFilters.employee_id ? ' para el empleado filtrado' : ''
                          }. Los ya confirmados o pagados no cambian.`
                        : ''
                }
                confirmText="Confirmar"
            />
        </>
    );
}

/* --------------------------------------------------------------- auxiliares */

function Metric({
    label,
    value,
    accent = false,
    className = '',
}: {
    label: string;
    value: string;
    accent?: boolean;
    className?: string;
}) {
    return (
        <div className={`emp-card min-w-[144px] shrink-0 p-[17px] sm:min-w-0 ${className}`}>
            <p className="emp-kicker">{label}</p>
            <p
                className="mt-1 text-[27px] leading-none tabular-nums"
                style={{ color: accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
            >
                {value}
            </p>
        </div>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <div className="min-w-0">
            <label className="emp-label">{label}</label>
            <div className="relative">
                <select value={value} onChange={(e) => onChange(e.target.value)} className="emp-field">
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>
        </div>
    );
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="min-w-0">
            <label className="emp-label">{label}</label>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="emp-field" />
        </div>
    );
}

export default ProductionListing;
