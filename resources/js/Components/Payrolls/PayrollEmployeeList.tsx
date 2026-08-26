import { CaretRight, MagnifyingGlass, Warning } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { employeeName, hoursFromMinutes, modeLabel, rowGross, sessionMinutes } from '@/lib/payrolls';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PayrollEmployee, Production, WorkDaySession } from '@/types';

export type EmployeeModeFilter = 'all' | 'operations' | 'fixed_daily' | 'hourly_legal';

const MODE_SEGMENTS: { value: EmployeeModeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'operations', label: 'Operaciones' },
    { value: 'fixed_daily', label: 'Jornada' },
    { value: 'hourly_legal', label: 'Horas (legal)' },
];

/** Reticula de la lista maestra, compartida por la cabecera y las filas. */
export const EMPLOYEE_GRID = 'minmax(0,1fr) 118px 118px 22px';

interface Props {
    rows: PayrollEmployee[];
    selectedId: number | null;
    onSelect: (payrollEmployeeId: number) => void;
    search: string;
    onSearch: (value: string) => void;
    mode: EmployeeModeFilter;
    onMode: (mode: EmployeeModeFilter) => void;
    sessionsByEmployee: Record<string, WorkDaySession[]>;
    productionsByEmployee: Record<string, Production[]>;
}

/** Segunda linea de la fila: documento, modalidad y el volumen que sustenta el pago. */
export function employeeSubline(
    row: PayrollEmployee,
    sessions: WorkDaySession[],
    productions: Production[],
): string {
    const parts = [
        row.employee?.document_number ? `CC ${row.employee.document_number}` : null,
        modeLabel(row.employee?.payroll_mode),
    ].filter(Boolean) as string[];

    if (row.employee?.payroll_mode === 'operations') {
        const units = productions.reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
        if (productions.length > 0) parts.push(`${formatNumber(units)} unidades`);
    } else if (sessions.length > 0) {
        const minutes = sessionMinutes(sessions);
        parts.push(`${formatNumber(sessions.length)} jornadas · ${hoursFromMinutes(minutes)} h`);
    }

    return parts.join(' · ');
}

/**
 * Lista maestra de empleados del periodo.
 *
 * Sustituye a la tabla de once columnas con filas desplegables: la fila responde quien es y
 * cuanto se lleva, y el detalle completo vive en el panel de al lado, sin arrastrar la
 * pagina en horizontal.
 */
export function PayrollEmployeeList({
    rows,
    selectedId,
    onSelect,
    search,
    onSearch,
    mode,
    onMode,
    sessionsByEmployee,
    productionsByEmployee,
}: Props) {
    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();

        return rows.filter((row) => {
            if (mode !== 'all' && (row.employee?.payroll_mode ?? 'operations') !== mode) {
                return false;
            }

            if (term === '') return true;

            return `${row.employee?.first_name ?? ''} ${row.employee?.last_name ?? ''} ${
                row.employee?.document_number ?? ''
            }`
                .toLowerCase()
                .includes(term);
        });
    }, [rows, search, mode]);

    const totals = useMemo(
        () =>
            visible.reduce(
                (acc, row) => ({
                    gross: acc.gross + rowGross(row),
                    net: acc.net + Number(row.net_payment ?? 0),
                }),
                { gross: 0, net: 0 },
            ),
        [visible],
    );

    return (
        <div className="min-w-0">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:max-w-[280px] sm:flex-1">
                    <MagnifyingGlass
                        size={15}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <input
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Buscar empleado..."
                        aria-label="Buscar empleado en la nómina"
                        className="emp-field pl-8"
                    />
                </div>

                <div className="emp-seg sm:w-[380px]">
                    {MODE_SEGMENTS.map((segment) => (
                        <button
                            key={segment.value}
                            type="button"
                            onClick={() => onMode(segment.value)}
                            className={`emp-seg-item ${mode === segment.value ? 'emp-seg-on' : ''}`}
                        >
                            {segment.label}
                        </button>
                    ))}
                </div>
            </div>

            <div
                className="mt-3 grid items-center gap-2.5 px-3 pb-2"
                style={{ gridTemplateColumns: EMPLOYEE_GRID, borderBottom: '1px solid var(--emp-border)' }}
            >
                {['Empleado', 'Bruto', 'Neto', ''].map((column, index) => (
                    <span
                        key={column || `col-${index}`}
                        className={`text-[11px] uppercase tracking-[0.09em] ${index > 0 && index < 3 ? 'text-right' : ''}`}
                        style={{ color: 'var(--emp-subtle)' }}
                    >
                        {column}
                    </span>
                ))}
            </div>

            {visible.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                    {rows.length === 0
                        ? 'Aún no se ha calculado la nómina. Usa la acción del estado para procesarla.'
                        : 'Ningún empleado coincide con el filtro.'}
                </p>
            ) : (
                visible.map((row) => {
                    const selected = row.id === selectedId;
                    const alerts = row.overtime_limit_alerts ?? [];
                    const sessions = row.employee_id ? sessionsByEmployee[String(row.employee_id)] ?? [] : [];
                    const productions = row.employee_id ? productionsByEmployee[String(row.employee_id)] ?? [] : [];

                    return (
                        <button
                            key={row.id}
                            type="button"
                            onClick={() => onSelect(row.id)}
                            aria-current={selected ? 'true' : undefined}
                            className="emp-hover-row emp-row-sep grid w-full items-center gap-2.5 px-3 py-2.5 text-left"
                            style={{
                                gridTemplateColumns: EMPLOYEE_GRID,
                                ...(selected
                                    ? {
                                          backgroundColor: 'var(--emp-row-hover)',
                                          boxShadow: 'inset 2px 0 0 var(--emp-accent-line)',
                                      }
                                    : {}),
                            }}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate text-[14px] capitalize" style={{ color: 'var(--emp-text)' }}>
                                        {employeeName(row)}
                                    </span>
                                    {alerts.length > 0 ? (
                                        <span className="emp-pill emp-pill-warn shrink-0">
                                            <Warning size={11} />
                                            Tope excedido
                                        </span>
                                    ) : null}
                                </div>
                                <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                    {employeeSubline(row, sessions, productions)}
                                </p>
                            </div>

                            <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                {formatCurrency(rowGross(row))}
                            </span>

                            <span
                                className="text-right text-[14px] tabular-nums"
                                style={{ color: selected ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {formatCurrency(row.net_payment)}
                            </span>

                            <CaretRight size={13} style={{ color: 'var(--emp-subtle)' }} />
                        </button>
                    );
                })
            )}

            {visible.length > 0 ? (
                <div
                    className="emp-strip grid items-center gap-2.5 rounded-b-[10px] px-3 py-2.5"
                    style={{ gridTemplateColumns: EMPLOYEE_GRID }}
                >
                    <span className="text-[12px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                        Totales · {formatNumber(visible.length)}
                        {visible.length === rows.length ? '' : ` de ${formatNumber(rows.length)}`}{' '}
                        {visible.length === 1 ? 'empleado' : 'empleados'}
                    </span>
                    <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                        {formatCurrency(totals.gross)}
                    </span>
                    <span className="text-right text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(totals.net)}
                    </span>
                    <span />
                </div>
            ) : null}
        </div>
    );
}

export default PayrollEmployeeList;
