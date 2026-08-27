import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';
import { TYPE_LABELS, WIDGET_TYPES } from '@/lib/dashboard-widgets';
import { formatNumber } from '@/lib/utils';

export interface WidgetFilters {
    search: string;
    state: 'active' | 'inactive' | 'all';
    type: WidgetType | null;
    /** 'any' | 'none' | id de empresa en texto. */
    assignment: string;
}

const STATE_SEGMENTS: { value: WidgetFilters['state']; label: string }[] = [
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'all', label: 'Todos' },
];

interface Props {
    filters: WidgetFilters;
    onChange: (next: WidgetFilters) => void;
    companies: { id: number; name: string }[];
    total: number;
    unassigned: number;
}

/**
 * Filtros del listado de widgets.
 *
 * No hay botón «Filtrar»: cada cambio recarga. La búsqueda espera 300 ms para no disparar
 * una petición por letra.
 */
export function WidgetFilterBar({ filters, onChange, companies, total, unassigned }: Props) {
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
            <div className="relative min-w-0 sm:max-w-[320px] sm:flex-1">
                <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar por título, nombre interno o tabla…"
                    aria-label="Buscar widget"
                    className="emp-field pl-8"
                />
            </div>

            <div className="emp-seg sm:w-[260px]">
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
            <div className="relative w-[150px] shrink-0 max-sm:hidden">
                <select
                    value={filters.type ?? ''}
                    onChange={(e) =>
                        onChange({ ...filters, type: e.target.value === '' ? null : (e.target.value as WidgetType) })
                    }
                    aria-label="Filtrar por tipo de widget"
                    className="emp-field"
                >
                    <option value="">Todo tipo</option>
                    {WIDGET_TYPES.map((type) => (
                        <option key={type} value={type}>
                            {TYPE_LABELS[type]}
                        </option>
                    ))}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>

            <div className="relative w-[170px] shrink-0 max-sm:hidden">
                <select
                    value={filters.assignment}
                    onChange={(e) => onChange({ ...filters, assignment: e.target.value })}
                    aria-label="Filtrar por asignación"
                    className="emp-field"
                >
                    <option value="any">Cualquier asignación</option>
                    <option value="none">Sin asignar</option>
                    {companies.map((company) => (
                        <option key={company.id} value={String(company.id)}>
                            {company.name}
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
                {formatNumber(total)} {total === 1 ? 'widget' : 'widgets'} · {formatNumber(unassigned)} sin asignar
            </span>
        </div>
    );
}

export default WidgetFilterBar;
