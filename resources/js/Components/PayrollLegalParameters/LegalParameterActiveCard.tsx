import { Link } from '@inertiajs/react';
import { PencilSimple } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import { hourlyValue, surchargeValue, type LegalParameterRow } from '@/lib/legalParameters';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface Props {
    active: LegalParameterRow;
    salaryExample: number;
    /** true si el tramo vigente es propio de la empresa (manda sobre los globales). */
    hasCompanyOverride: boolean;
}

/**
 * El tramo que rige hoy, con los valores efectivos.
 *
 * Es lo que la tabla de siete columnas no decia: cual de los tramos esta usando la nomina
 * en este momento y cuanto vale la hora con el.
 */
export function LegalParameterActiveCard({ active, salaryExample, hasCompanyOverride }: Props) {
    const ordinary = hourlyValue(salaryExample, active.monthly_hours_divisor);

    const cells = [
        {
            kicker: 'Jornada semanal',
            value: `${formatNumber(active.weekly_legal_hours)} h`,
            note: `Divisor mensual ${formatNumber(active.monthly_hours_divisor)}`,
        },
        {
            kicker: 'Hora ordinaria',
            value: formatCurrency(ordinary),
            note: `Sobre ${formatCurrency(salaryExample)} de ejemplo`,
        },
        {
            kicker: 'Franja nocturna',
            value: `${active.night_start_time}–${active.night_end_time}`,
            note: `Recargo ${formatNumber(active.night_surcharge_percent)}%`,
        },
        {
            kicker: 'Extra diurna',
            value: `+${formatNumber(active.overtime_day_percent)}%`,
            note: `${formatCurrency(surchargeValue(salaryExample, active.monthly_hours_divisor, active.overtime_day_percent))} por hora`,
        },
        {
            kicker: 'Extra nocturna',
            value: `+${formatNumber(active.overtime_night_percent)}%`,
            note: `${formatCurrency(surchargeValue(salaryExample, active.monthly_hours_divisor, active.overtime_night_percent))} por hora`,
        },
        {
            kicker: 'Dominical / festivo',
            value: `+${formatNumber(active.sunday_holiday_surcharge_percent)}%`,
            note: `${formatCurrency(surchargeValue(salaryExample, active.monthly_hours_divisor, active.sunday_holiday_surcharge_percent))} por hora`,
        },
    ];

    return (
        <section className="emp-card p-[17px]">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="emp-kicker">Vigente hoy · {formatDate(new Date().toISOString().slice(0, 10))}</p>
                    <h2 className="mt-0.5 text-[17px]" style={{ color: 'var(--emp-text)' }}>
                        Jornada de {formatNumber(active.weekly_legal_hours)} horas · divisor{' '}
                        {formatNumber(active.monthly_hours_divisor)}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`emp-pill ${active.scope === 'company' ? 'emp-pill-accent' : ''}`}>
                            {active.scope === 'company' ? 'Tramo de esta empresa' : 'Tramo global'}
                        </span>
                        <span className="emp-pill">
                            Desde {formatDate(active.effective_from)} ·{' '}
                            {active.effective_to ? `hasta ${formatDate(active.effective_to)}` : 'indefinido'}
                        </span>
                    </div>
                </div>

                <Can permission="payroll_legal_parameters.index.edit">
                    <Link href={route('payroll-legal-parameters.edit', active.id)} className="emp-btn emp-btn-sm shrink-0">
                        <PencilSimple size={15} />
                        Editar tramo vigente
                    </Link>
                </Can>
            </header>

            <div
                className="mt-4 grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))' }}
            >
                {cells.map((cell) => (
                    <div key={cell.kicker} className="min-w-0">
                        <p className="emp-kicker">{cell.kicker}</p>
                        <p className="mt-1 text-[17px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {cell.value}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {cell.note}
                        </p>
                    </div>
                ))}
            </div>

            <p className="mt-3.5 pt-3 text-[11.5px]" style={{ borderTop: '1px solid var(--emp-border)', color: 'var(--emp-muted)' }}>
                {hasCompanyOverride ? (
                    <>
                        Tu empresa tiene tramo propio desde el {formatDate(active.effective_from)}, así que este manda
                        sobre los tramos globales. Si se elimina, la nómina vuelve al tramo global vigente en cada fecha.
                    </>
                ) : (
                    <>
                        Tu empresa no tiene tramo propio: rige el global. Crea uno si necesitas jornada, recargos o
                        franja nocturna distintos; el global seguirá aplicando a las demás empresas.
                    </>
                )}
            </p>
        </section>
    );
}

export default LegalParameterActiveCard;
