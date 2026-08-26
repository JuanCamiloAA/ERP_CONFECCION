import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { difficultyLabel } from '@/lib/difficulty';
import { formatNumber } from '@/lib/utils';

export interface OperationFilters {
    search: string;
    status: string;
    difficulty: string;
}

const STATUS_SEGMENTS = [
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
    { value: 'all', label: 'Todas' },
];

interface Props {
    filters: OperationFilters;
    onChange: (next: OperationFilters) => void;
    total: number;
}

/**
 * Filtros del catalogo de operaciones.
 *
 * La busqueda espera 300 ms antes de recargar: escribir «pegar sesgo» disparaba once
 * peticiones, y la lista parpadeaba con cada letra.
 */
export function OperationFilterBar({ filters, onChange, total }: Props) {
    const [term, setTerm] = useState(filters.search);

    // Si el filtro cambia desde fuera (limpiar todo), el campo tiene que seguirlo.
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
            <div className="relative min-w-0 sm:max-w-[420px] sm:flex-1">
                <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar operación…"
                    aria-label="Buscar operación"
                    className="emp-field pl-8"
                />
            </div>

            <div className="emp-seg sm:w-[240px]">
                {STATUS_SEGMENTS.map((segment) => (
                    <button
                        key={segment.value}
                        type="button"
                        onClick={() => onChange({ ...filters, status: segment.value })}
                        className={`emp-seg-item ${filters.status === segment.value ? 'emp-seg-on' : ''}`}
                    >
                        {segment.label}
                    </button>
                ))}
            </div>

            <div className="relative max-sm:hidden">
                <select
                    value={filters.difficulty}
                    onChange={(e) => onChange({ ...filters, difficulty: e.target.value })}
                    aria-label="Filtrar por dificultad"
                    className="emp-field w-[190px]"
                >
                    <option value="">Toda dificultad</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={level}>
                            {level} · {difficultyLabel(level)}
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
                {formatNumber(total)} {total === 1 ? 'operación' : 'operaciones'}
            </span>
        </div>
    );
}

export default OperationFilterBar;
