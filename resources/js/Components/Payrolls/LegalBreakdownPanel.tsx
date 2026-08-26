import { Warning } from '@phosphor-icons/react';
import { hoursFromMinutes } from '@/lib/payrolls';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { LegalHoursBreakdown } from '@/types';

interface Props {
    breakdown: LegalHoursBreakdown;
    alerts: string[];
}

const DETAIL_GRID = '96px repeat(4,minmax(0,1fr)) 96px 104px';

const DETAIL_COLUMNS = [
    'Fecha',
    'Ord. diurna',
    'Ord. nocturna',
    'Extra diurna',
    'Extra nocturna',
    'Dom/Festivo',
    'Valor del día',
];

/**
 * Recargos y horas extra de la modalidad por horas.
 *
 * El detalle por dia es lo que permite defender la cifra ante el empleado: sin el, el
 * recargo nocturno es un numero que aparece de la nada. Los parametros aplicados se leen
 * del retrato guardado en el calculo, no de la configuracion vigente hoy: si alguien cambia
 * el valor/hora despues, la nomina ya liquidada tiene que seguir explicandose sola.
 */
export function LegalBreakdownPanel({ breakdown, alerts }: Props) {
    const snapshot = breakdown.legal_parameters_snapshot ?? {};
    const detail = breakdown.daily_detail ?? [];

    const cells = [
        { label: 'Salario base periodo', value: breakdown.base_salary_earned, tone: 'text' as const },
        { label: 'Recargo nocturno', value: breakdown.night_surcharge_amount, tone: 'text' as const },
        { label: 'Dominical / festivo', value: breakdown.sunday_holiday_surcharge_amount, tone: 'text' as const },
        { label: 'Horas extra', value: breakdown.overtime_amount, tone: 'accent' as const },
    ];

    return (
        <section className="emp-card p-[15px_16px]">
            <p className="emp-kicker">Recargos y horas extra (ley)</p>

            {alerts.length > 0 ? (
                <div className="emp-note mt-2.5" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                    <p className="flex items-center gap-1.5" style={{ color: 'var(--emp-danger)' }}>
                        <Warning size={14} />
                        Horas extra sobre el tope legal
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                        {alerts.map((alert, index) => (
                            <li key={index}>{alert}</li>
                        ))}
                    </ul>
                    <p className="mt-1">
                        Las horas extra requieren autorización previa del Ministerio del Trabajo; el sistema no verifica
                        ese trámite.
                    </p>
                </div>
            ) : null}

            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {cells.map((cell) => (
                    <div key={cell.label} className="min-w-0">
                        <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {cell.label}
                        </p>
                        <p
                            className="mt-0.5 truncate text-[15px] tabular-nums"
                            style={{ color: cell.tone === 'accent' ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                        >
                            {formatCurrency(cell.value)}
                        </p>
                    </div>
                ))}
            </div>

            <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                Valor/hora aplicado {formatCurrency(breakdown.hourly_rate_applied)} · jornada semanal legal{' '}
                {String(snapshot.weekly_legal_hours ?? '—')} h · divisor mensual{' '}
                {String(snapshot.monthly_hours_divisor ?? '—')}
            </p>

            {detail.length > 0 ? (
                <>
                    <p className="emp-kicker mt-4">Detalle por día</p>

                    {/* Escritorio: rejilla. */}
                    <div className="mt-2 hidden lg:block">
                        <div
                            className="grid items-center gap-2 px-2 pb-1.5"
                            style={{ gridTemplateColumns: DETAIL_GRID, borderBottom: '1px solid var(--emp-border)' }}
                        >
                            {DETAIL_COLUMNS.map((column, index) => (
                                <span
                                    key={column}
                                    className={`text-[10.5px] uppercase tracking-[0.09em] ${index > 0 ? 'text-right' : ''}`}
                                    style={{ color: 'var(--emp-subtle)' }}
                                >
                                    {column}
                                </span>
                            ))}
                        </div>

                        {detail.map((day) => (
                            <div
                                key={`${day.work_date}-${day.session_id}`}
                                className="emp-row-sep grid items-center gap-2 px-2 py-1.5"
                                style={{ gridTemplateColumns: DETAIL_GRID }}
                            >
                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                    {formatDate(day.work_date)}
                                </span>
                                <span className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                    {hoursFromMinutes(day.ordinary_day_minutes)}
                                </span>
                                <span className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                    {hoursFromMinutes(day.ordinary_night_minutes)}
                                </span>
                                <span className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                                    {hoursFromMinutes(day.extra_day_minutes)}
                                </span>
                                <span className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                                    {hoursFromMinutes(day.extra_night_minutes)}
                                </span>
                                <span className="text-right text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    {day.is_sunday_holiday ? 'Sí' : '—'}
                                </span>
                                <span className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                    {formatCurrency(day.day_amount)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Movil: una tarjeta por dia. */}
                    <div className="mt-2 flex flex-col gap-1.5 lg:hidden">
                        {detail.map((day) => (
                            <div
                                key={`${day.work_date}-${day.session_id}`}
                                className="rounded-[10px] p-2.5"
                                style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatDate(day.work_date)}
                                        {day.is_sunday_holiday ? ' · dom/festivo' : ''}
                                    </span>
                                    <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatCurrency(day.day_amount)}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                    Ordinaria {hoursFromMinutes(day.ordinary_day_minutes)} h · nocturna{' '}
                                    {hoursFromMinutes(day.ordinary_night_minutes)} h · extra{' '}
                                    {hoursFromMinutes(day.extra_day_minutes + day.extra_night_minutes)} h
                                </p>
                            </div>
                        ))}
                    </div>
                </>
            ) : null}
        </section>
    );
}

export default LegalBreakdownPanel;
