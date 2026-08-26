import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { hourlyValue, type LegalParameterRow } from '@/lib/legalParameters';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { PayrollLegalParameterFormData } from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';

interface Props {
    active: LegalParameterRow | null;
    data: PayrollLegalParameterFormData;
    salary: number;
}

/**
 * Diferencias frente al tramo que rige hoy.
 *
 * Al crear un tramo nuevo la pregunta no es «que valores tiene» sino «en que cambia lo
 * que estamos pagando».
 */
export function LegalCompareCard({ active, data, salary }: Props) {
    if (!active) {
        return (
            <EmployeeAsideCard title="Frente al tramo vigente">
                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    Todavía no hay un tramo vigente con el que comparar: este será el primero.
                </p>
            </EmployeeAsideCard>
        );
    }

    const newHours = Number(data.weekly_legal_hours) || 0;
    const newDivisor = Number(data.monthly_hours_divisor) || 0;
    const newNight = Number(data.night_surcharge_percent) || 0;

    const rows = [
        {
            label: 'Jornada semanal',
            delta: newHours - active.weekly_legal_hours,
            format: (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value)} h`,
        },
        {
            label: 'Divisor mensual',
            delta: newDivisor - active.monthly_hours_divisor,
            format: (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value)}`,
        },
        {
            label: 'Hora ordinaria',
            delta: hourlyValue(salary, newDivisor) - hourlyValue(salary, active.monthly_hours_divisor),
            format: (value: number) => `${value > 0 ? '+' : ''}${formatCurrency(value)}`,
        },
        {
            label: 'Recargo nocturno',
            delta: newNight - active.night_surcharge_percent,
            format: (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value)} p.p.`,
        },
    ];

    return (
        <EmployeeAsideCard
            title="Frente al tramo vigente"
            subtitle={`${formatNumber(active.weekly_legal_hours)} h · divisor ${formatNumber(
                active.monthly_hours_divisor,
            )} · desde ${formatDate(active.effective_from)}`}
        >
            <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                {rows.map((row) => {
                    const same = Math.abs(row.delta) < 0.005;

                    return (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                            <dt style={{ color: 'var(--emp-muted)' }}>{row.label}</dt>
                            <dd
                                className="tabular-nums"
                                style={{ color: same ? 'var(--emp-text)' : 'var(--emp-accent-on)' }}
                            >
                                {same ? 'igual' : row.format(row.delta)}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </EmployeeAsideCard>
    );
}

export default LegalCompareCard;
