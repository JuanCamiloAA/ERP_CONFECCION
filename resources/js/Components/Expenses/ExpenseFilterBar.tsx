import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useState } from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { ExpensePeriod } from '@/lib/expenses';

export interface ExpenseFilters {
    search: string;
    category_id: number | null;
    period: ExpensePeriod;
    date_from: string | null;
    date_to: string | null;
}

export interface CategoryOption {
    id: number;
    name: string;
    is_active: boolean;
}

const PERIOD_SEGMENTS: { value: ExpensePeriod; label: string }[] = [
    { value: 'mes', label: 'Este mes' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'anio', label: 'Año' },
    { value: 'todos', label: 'Todos' },
];

interface Props {
    filters: ExpenseFilters;
    onChange: (next: ExpenseFilters) => void;
    categories: CategoryOption[];
    total: number;
    filteredTotal: number;
    /** Controles que van al extremo derecho de la barra (hoy, el conmutador de vista). */
    trailing?: ReactNode;
}

/**
 * Filtros del listado de gastos.
 *
 * Sin boton «Filtrar»: cada cambio recarga, y el buscador espera 300 ms para no disparar
 * una peticion por letra. El rango de fechas deja de ser dos campos sueltos siempre
 * visibles y se abre desde «Todos».
 */
export function ExpenseFilterBar({ filters, onChange, categories, total, filteredTotal, trailing }: Props) {
    const [term, setTerm] = useState(filters.search);
    const [rangeOpen, setRangeOpen] = useState(Boolean(filters.date_from || filters.date_to));

    useEffect(() => {
        setTerm(filters.search);
    }, [filters.search]);

    useEffect(() => {
        if (term === filters.search) {
            return;
        }

        const timer = window.setTimeout(() => onChange({ ...filters, search: term }), 300);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const pickPeriod = (period: ExpensePeriod) => {
        if (period === 'todos') {
            setRangeOpen(true);
        } else {
            setRangeOpen(false);
        }

        // Al elegir un periodo se limpia el rango: dos filtros de fecha a la vez dejarian
        // al usuario sin saber cual manda.
        onChange({ ...filters, period, date_from: null, date_to: null });
    };

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:max-w-[360px] sm:flex-1">
                    <MagnifyingGlass
                        size={15}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Buscar descripción, proveedor o nota..."
                        aria-label="Buscar gasto"
                        className="emp-field pl-8"
                    />
                </div>

                <div className="emp-seg sm:w-[300px]">
                    {PERIOD_SEGMENTS.map((segment) => (
                        <button
                            key={segment.value}
                            type="button"
                            onClick={() => pickPeriod(segment.value)}
                            className={`emp-seg-item ${filters.period === segment.value ? 'emp-seg-on' : ''}`}
                        >
                            {segment.label}
                        </button>
                    ))}
                </div>

                <div className="relative max-sm:hidden">
                    <select
                        value={filters.category_id ?? ''}
                        onChange={(e) =>
                            onChange({ ...filters, category_id: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        aria-label="Filtrar por categoría"
                        className="emp-field w-[210px]"
                    >
                        <option value="">Todas las categorías</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                                {category.is_active ? '' : ' (inactiva)'}
                            </option>
                        ))}
                    </select>
                    <CaretDown
                        size={13}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                </div>

                <span className="shrink-0 text-[12px] max-sm:hidden sm:ml-auto" style={{ color: 'var(--emp-subtle)' }}>
                    {formatNumber(total)} {total === 1 ? 'gasto' : 'gastos'} · {formatCurrency(filteredTotal)}
                </span>

                {trailing}
            </div>

            {/* El rango vive dentro de «Todos»: es donde tiene sentido acotar a mano. */}
            {filters.period === 'todos' ? (
                <div className="flex flex-wrap items-center gap-2">
                    {rangeOpen ? (
                        <>
                            <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Desde
                                <input
                                    type="date"
                                    value={filters.date_from ?? ''}
                                    onChange={(e) => onChange({ ...filters, date_from: e.target.value || null })}
                                    className="emp-field w-[150px]"
                                />
                            </label>
                            <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Hasta
                                <input
                                    type="date"
                                    value={filters.date_to ?? ''}
                                    onChange={(e) => onChange({ ...filters, date_to: e.target.value || null })}
                                    className="emp-field w-[150px]"
                                />
                            </label>
                            {filters.date_from || filters.date_to ? (
                                <button
                                    type="button"
                                    onClick={() => onChange({ ...filters, date_from: null, date_to: null })}
                                    className="text-[12px] underline underline-offset-2"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                >
                                    Quitar rango
                                </button>
                            ) : null}
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setRangeOpen(true)}
                            className="text-[12px] underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            Rango…
                        </button>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default ExpenseFilterBar;
