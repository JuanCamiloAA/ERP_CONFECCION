import { formatCurrency } from '@/lib/utils';

export interface PayrollEmployeeTotals {
    employee_count: number;
    total_production: number;
    total_daily: number;
    total_legal_hourly: number;
    total_adjustments: number;
    total_gross: number;
    total_advances: number;
    total_absence_discount: number;
    total_deductions: number;
    show_daily_column: boolean;
    show_legal_column: boolean;
}

interface Props {
    totals: PayrollEmployeeTotals;
    /** Neto de la nomina (`payroll.total_amount`), que ya trae aplicadas las deducciones. */
    net: string | number;
}

/**
 * Una sola franja de totales para escritorio y movil.
 *
 * Antes habia siete tarjetas de colores en el escritorio y un resumen distinto en el
 * telefono: dos lecturas del mismo periodo que no siempre coincidian. Aqui las columnas de
 * jornada y jornada legal se ocultan cuando nadie las usa, como en la tabla.
 */
export function PayrollTotalsStrip({ totals, net }: Props) {
    const cells = [
        { label: 'Producido', value: totals.total_production, show: true, tone: 'text' as const, sign: '' },
        { label: 'Jornada', value: totals.total_daily, show: totals.show_daily_column, tone: 'text' as const, sign: '' },
        {
            label: 'Legal (horas)',
            value: totals.total_legal_hourly,
            show: totals.show_legal_column,
            tone: 'text' as const,
            sign: '',
        },
        { label: 'Ajustes', value: totals.total_adjustments, show: true, tone: 'accent' as const, sign: '+ ' },
        { label: 'Deducciones', value: totals.total_deductions, show: true, tone: 'danger' as const, sign: '− ' },
        { label: 'Anticipos', value: totals.total_advances, show: true, tone: 'danger' as const, sign: '− ' },
    ].filter((cell) => cell.show);

    const color = (tone: 'text' | 'accent' | 'danger') =>
        tone === 'accent' ? 'var(--emp-accent-on)' : tone === 'danger' ? 'var(--emp-danger)' : 'var(--emp-text)';

    return (
        <section className="emp-card mt-4 p-[14px_18px]">
            {/* Escritorio: una fila de celdas con el neto separado por un filo. */}
            <div
                className="hidden gap-[14px] lg:grid"
                style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0,1fr)) 200px` }}
            >
                {cells.map((cell) => (
                    <div key={cell.label} className="min-w-0">
                        <p className="emp-kicker">{cell.label}</p>
                        <p className="mt-1 truncate text-[16px] tabular-nums" style={{ color: color(cell.tone) }}>
                            {cell.sign}
                            {formatCurrency(cell.value)}
                        </p>
                    </div>
                ))}

                <div className="min-w-0 pl-[14px]" style={{ borderLeft: '1px solid var(--emp-border)' }}>
                    <p className="emp-kicker">Neto a pagar</p>
                    <p className="mt-0.5 truncate text-[26px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                        {formatCurrency(net)}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        bruto {formatCurrency(totals.total_gross)}
                    </p>
                </div>
            </div>

            {/* Movil: las mismas cifras en lista, con el neto al pie. */}
            <dl className="lg:hidden">
                {cells.map((cell) => (
                    <div key={cell.label} className="flex items-baseline justify-between gap-3 py-1">
                        <dt className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                            {cell.label}
                        </dt>
                        <dd className="text-[13px] tabular-nums" style={{ color: color(cell.tone) }}>
                            {cell.sign}
                            {formatCurrency(cell.value)}
                        </dd>
                    </div>
                ))}

                <div
                    className="mt-2 flex items-end justify-between gap-3 pt-2.5"
                    style={{ borderTop: '1px solid var(--emp-row)' }}
                >
                    <div>
                        <dt className="emp-kicker">Neto a pagar</dt>
                        <dd className="text-[24px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                            {formatCurrency(net)}
                        </dd>
                    </div>
                    <dd className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        bruto {formatCurrency(totals.total_gross)}
                    </dd>
                </div>
            </dl>
        </section>
    );
}

export default PayrollTotalsStrip;
