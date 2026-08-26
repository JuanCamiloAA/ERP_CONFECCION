import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/utils';
import type { Employee } from '@/types';

export interface AdvanceFilters {
    search: string;
    balance: string;
    employee_id: number | null;
}

const BALANCE_SEGMENTS = [
    { value: 'with', label: 'Con saldo' },
    { value: 'settled', label: 'Descontados' },
    { value: 'all', label: 'Todos' },
];

interface Props {
    filters: AdvanceFilters;
    onChange: (next: AdvanceFilters) => void;
    employees: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
    total: number;
    pendingCount: number;
}

/**
 * Filtros del listado de anticipos.
 *
 * No hay boton «Filtrar»: cada cambio recarga. La busqueda espera 300 ms para no disparar
 * una peticion por letra.
 */
export function AdvanceFilterBar({ filters, onChange, employees, total, pendingCount }: Props) {
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
            <div className="relative min-w-0 sm:max-w-[380px] sm:flex-1">
                <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar empleado o motivo..."
                    aria-label="Buscar anticipo"
                    className="emp-field pl-8"
                />
            </div>

            <div className="emp-seg sm:w-[290px]">
                {BALANCE_SEGMENTS.map((segment) => (
                    <button
                        key={segment.value}
                        type="button"
                        onClick={() => onChange({ ...filters, balance: segment.value })}
                        className={`emp-seg-item ${filters.balance === segment.value ? 'emp-seg-on' : ''}`}
                    >
                        {segment.label}
                    </button>
                ))}
            </div>

            <div className="relative max-sm:hidden">
                <select
                    value={filters.employee_id ?? ''}
                    onChange={(e) => onChange({ ...filters, employee_id: e.target.value === '' ? null : Number(e.target.value) })}
                    aria-label="Filtrar por empleado"
                    className="emp-field w-[200px]"
                >
                    <option value="">Todos los empleados</option>
                    {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
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
                {formatNumber(total)} {total === 1 ? 'anticipo' : 'anticipos'} · {formatNumber(pendingCount)} con saldo
            </span>
        </div>
    );
}

export default AdvanceFilterBar;
