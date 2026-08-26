import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmpInput } from '@/Components/UI/ModuleFields';
import { dailyValue, hourlyValue, surchargeValue } from '@/lib/legalParameters';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PayrollLegalParameterFormData } from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';

interface Props {
    data: PayrollLegalParameterFormData;
    salary: string;
    onSalaryChange: (value: string) => void;
}

/**
 * Cuanto vale cada porcentaje del tramo, en pesos, a medida que se escribe.
 *
 * Un 75% de recargo no le dice nada a quien aprueba la nomina; «$16.150 por hora» si.
 */
export function LegalSimulationCard({ data, salary, onSalaryChange }: Props) {
    const base = Number(salary) || 0;
    const divisor = Number(data.monthly_hours_divisor) || 0;
    const ordinary = hourlyValue(base, divisor);

    const rows = [
        { label: 'Hora ordinaria', value: ordinary },
        {
            label: `Hora nocturna (+${formatNumber(Number(data.night_surcharge_percent) || 0)}%)`,
            value: surchargeValue(base, divisor, Number(data.night_surcharge_percent) || 0),
        },
        {
            label: `Extra diurna (+${formatNumber(Number(data.overtime_day_percent) || 0)}%)`,
            value: surchargeValue(base, divisor, Number(data.overtime_day_percent) || 0),
        },
        {
            label: `Extra nocturna (+${formatNumber(Number(data.overtime_night_percent) || 0)}%)`,
            value: surchargeValue(base, divisor, Number(data.overtime_night_percent) || 0),
        },
        {
            label: `Dominical y festivo (+${formatNumber(Number(data.sunday_holiday_surcharge_percent) || 0)}%)`,
            value: surchargeValue(base, divisor, Number(data.sunday_holiday_surcharge_percent) || 0),
        },
        { label: 'Día de salario', value: dailyValue(base) },
    ];

    if (data.discount_unexcused_absences) {
        rows.push({
            label: `Día ausente (−${formatNumber(Number(data.absence_discount_percent) || 0)}%)`,
            value: -dailyValue(base) * ((Number(data.absence_discount_percent) || 0) / 100),
        });
    }

    return (
        <EmployeeAsideCard title="Simulación" subtitle="Se recalcula a cada tecla">
            <div className="mt-2">
                <EmpInput
                    label="Salario base mensual"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="1000"
                    prefix="$"
                    value={salary}
                    onChange={(e) => onSalaryChange(e.target.value)}
                />
            </div>

            <dl className="mt-3 flex flex-col gap-1.5 text-[12px]">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3">
                        <dt className="min-w-0 truncate" style={{ color: 'var(--emp-muted)' }}>
                            {row.label}
                        </dt>
                        <dd
                            className="shrink-0 tabular-nums"
                            style={{ color: row.value < 0 ? 'var(--emp-danger)' : 'var(--emp-text)' }}
                        >
                            {formatCurrency(row.value)}
                        </dd>
                    </div>
                ))}
            </dl>

            <p className="emp-help">
                Es una simulación de referencia sobre el salario que escribas: la nómina real usa el salario de cada
                empleado y sus horas marcadas.
            </p>
        </EmployeeAsideCard>
    );
}

export default LegalSimulationCard;
