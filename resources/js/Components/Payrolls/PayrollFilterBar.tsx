import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { type ReactNode, useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils';

export interface PayrollFilters {
    search: string;
    /** Abiertas (borrador/calculado), cerradas (aprobado/pagado) o todas. */
    state: 'open' | 'closed' | 'all';
    year: number;
    type: string | null;
}

const STATE_SEGMENTS: { value: PayrollFilters['state']; label: string }[] = [
    { value: 'open', label: 'Abiertas' },
    { value: 'closed', label: 'Cerradas' },
    { value: 'all', label: 'Todas' },
];

interface Props {
    filters: PayrollFilters;
    onChange: (next: PayrollFilters) => void;
    periodicities: { code: string; name: string }[];
    years: number[];
    total: number;
    openCount: number;
    /** Controles que van al extremo derecho de la barra (hoy, el conmutador de vista). */
    trailing?: ReactNode;
}

/**
 * Filtros del listado de nomina.
 *
 * No hay boton «Filtrar»: cada cambio recarga. La busqueda espera 300 ms para no disparar
 * una peticion por letra. En movil solo quedan buscador y segmentado; ano y periodicidad
 * son afinados de escritorio y en el telefono solo estorban.
 */
export function PayrollFilterBar({ filters, onChange, periodicities, years, total, openCount, trailing }: Props) {
    const [term, setTerm] = useState(filters.search);

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

    return (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:max-w-[340px] sm:flex-1">
                <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar nómina o periodo..."
                    aria-label="Buscar nómina"
                    className="emp-field pl-8"
                />
            </div>

            <div className="emp-seg sm:w-[290px]">
                {STATE_SEGMENTS.map((segment) => (
                    <button
                        key={segment.value}
                        type="button"
                        onClick={() => onChange({ ...filters, state: segment.value })}
                        className={`emp-seg-item ${filters.state === segment.value ? 'emp-seg-on' : ''}`}
                    >
                        {segment.label}
                    </button>
                ))}
            </div>

            {/* El ancho va en el contenedor: `.emp-field` fija `width:100%` desde una hoja sin
                capa y le gana a las utilidades de Tailwind. */}
            <div className="relative w-[120px] shrink-0 max-sm:hidden">
                <select
                    value={filters.year}
                    onChange={(e) => onChange({ ...filters, year: Number(e.target.value) })}
                    aria-label="Filtrar por año"
                    className="emp-field"
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>

            <div className="relative w-[150px] shrink-0 max-sm:hidden">
                <select
                    value={filters.type ?? ''}
                    onChange={(e) => onChange({ ...filters, type: e.target.value === '' ? null : e.target.value })}
                    aria-label="Filtrar por periodicidad"
                    className="emp-field"
                >
                    <option value="">Toda periodicidad</option>
                    {periodicities.map((periodicity) => (
                        <option key={periodicity.code} value={periodicity.code}>
                            {periodicity.name}
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
                {formatNumber(total)} {total === 1 ? 'nómina' : 'nóminas'} · {formatNumber(openCount)}{' '}
                {openCount === 1 ? 'abierta' : 'abiertas'}
            </span>

            {trailing}
        </div>
    );
}

export default PayrollFilterBar;
