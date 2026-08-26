import { Link } from '@inertiajs/react';
import { ArrowUpRight, Warning } from '@phosphor-icons/react';
import { AbsenceList } from '@/Components/Payrolls/AbsenceList';
import { AdvanceDiscountList } from '@/Components/Payrolls/AdvanceDiscountList';
import { ManualConceptsPanel } from '@/Components/Payrolls/ManualConceptsPanel';
import type { PayrollEditors } from '@/Components/Payrolls/usePayrollEdits';
import {
    deductionsTotal,
    employeeName,
    hoursFromMinutes,
    modeLabel,
    rowGross,
    sessionMinutes,
} from '@/lib/payrolls';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Payroll, PayrollConcept, PayrollEmployee, Production, WorkDaySession } from '@/types';

interface Props {
    payroll: Payroll;
    row: PayrollEmployee;
    sessions: WorkDaySession[];
    productions: Production[];
    concepts: PayrollConcept[];
    editors: PayrollEditors;
    canEditTime: boolean;
    canManageAdjustments: boolean;
}

interface LiquidationRow {
    label: string;
    value: number;
    tone?: 'text' | 'muted' | 'danger' | 'accent';
    sign?: string;
}

/**
 * Liquidacion del empleado desglosada segun su modalidad.
 *
 * Solo se listan las lineas que aportan algo: en pago por operacion no tiene sentido una
 * fila de recargo nocturno en cero, y llenar el panel de ceros esconde lo que si cambia.
 */
export function liquidationRows(row: PayrollEmployee): LiquidationRow[] {
    const mode = row.employee?.payroll_mode ?? 'operations';
    const breakdown = row.legal_hours_breakdown;
    const rows: LiquidationRow[] = [];

    if (mode === 'hourly_legal' && breakdown) {
        rows.push({ label: 'Salario base periodo', value: breakdown.base_salary_earned });
        if (Number(breakdown.night_surcharge_amount) !== 0) {
            rows.push({ label: 'Recargo nocturno', value: breakdown.night_surcharge_amount });
        }
        if (Number(breakdown.sunday_holiday_surcharge_amount) !== 0) {
            rows.push({ label: 'Dominical / festivo', value: breakdown.sunday_holiday_surcharge_amount });
        }
        if (Number(breakdown.overtime_amount) !== 0) {
            rows.push({ label: 'Horas extra', value: breakdown.overtime_amount, tone: 'accent' });
        }
    } else if (mode === 'fixed_daily') {
        rows.push({ label: 'Jornada', value: Number(row.daily_work_subtotal ?? 0) });
    } else {
        rows.push({ label: 'Producido', value: Number(row.production_total ?? 0) });
    }

    if (Number(row.adjustments_subtotal ?? 0) !== 0) {
        rows.push({ label: 'Conceptos manuales', value: Number(row.adjustments_subtotal ?? 0), tone: 'accent', sign: '+ ' });
    }

    return rows;
}

const TONE: Record<string, string> = {
    text: 'var(--emp-text)',
    muted: 'var(--emp-muted)',
    danger: 'var(--emp-danger)',
    accent: 'var(--emp-accent-on)',
};

/**
 * Panel del empleado seleccionado: identidad, liquidacion y todo lo que se puede tocar
 * antes de recalcular. Es el sustituto de la fila expandida que apilaba cuatro bloques
 * dentro de un `colSpan` y obligaba a desplazarse en horizontal.
 */
export function PayrollEmployeePanel({
    payroll,
    row,
    sessions,
    productions,
    concepts,
    editors,
    canEditTime,
    canManageAdjustments,
}: Props) {
    const mode = row.employee?.payroll_mode ?? 'operations';
    const alerts = row.overtime_limit_alerts ?? [];
    const gross = rowGross(row);
    const deductions = deductionsTotal(row);
    const absence = Number(row.absence_discount_total ?? 0);
    const advances = Number(row.advances_discount ?? 0);
    const minutes = sessionMinutes(sessions);
    const units = productions.reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
    const name = employeeName(row);

    return (
        <div className="flex flex-col gap-3">
            {/* ------------------------------------------------- identidad */}
            <section className="emp-card p-[15px_16px]">
                <div className="flex items-start gap-3">
                    <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] capitalize"
                        style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                    >
                        {name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-[16px] capitalize" style={{ color: 'var(--emp-text)' }}>
                            {name}
                        </p>
                        <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                            {row.employee?.document_type ?? 'CC'} {row.employee?.document_number ?? '—'}
                        </p>
                    </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="emp-pill emp-pill-accent">{modeLabel(mode)}</span>
                    {mode === 'operations' ? (
                        productions.length > 0 ? (
                            <span className="emp-pill">{formatNumber(units)} unidades</span>
                        ) : null
                    ) : (
                        <span className="emp-pill">
                            {formatNumber(sessions.length)} jornadas · {hoursFromMinutes(minutes)} h
                        </span>
                    )}
                    {alerts.length > 0 ? (
                        <span className="emp-pill emp-pill-warn">
                            <Warning size={11} />
                            Tope excedido
                        </span>
                    ) : null}
                </div>

                {alerts.length > 0 ? (
                    <div className="emp-note mt-2.5" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                        <ul className="list-inside list-disc">
                            {alerts.map((alert, index) => (
                                <li key={index}>{alert}</li>
                            ))}
                        </ul>
                        <p className="mt-1">
                            Las horas extra requieren autorización previa del Ministerio del Trabajo; el sistema no
                            verifica ese trámite.
                        </p>
                    </div>
                ) : null}
            </section>

            {/* ----------------------------------------------- liquidacion */}
            <section className="emp-card p-[15px_16px]">
                <p className="emp-kicker">Liquidación</p>

                <div className="mt-2">
                    {liquidationRows(row).map((line) => (
                        <div key={line.label} className="flex items-baseline justify-between gap-3 py-1">
                            <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                {line.label}
                            </span>
                            <span
                                className="text-[12.5px] tabular-nums"
                                style={{ color: TONE[line.tone ?? 'text'] }}
                            >
                                {line.sign ?? ''}
                                {formatCurrency(line.value)}
                            </span>
                        </div>
                    ))}

                    <div
                        className="mt-1 flex items-baseline justify-between gap-3 pt-1.5"
                        style={{ borderTop: '1px solid var(--emp-row)' }}
                    >
                        <span className="text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                            Bruto devengado
                        </span>
                        <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(gross)}
                        </span>
                    </div>

                    {deductions > 0 ? (
                        <div className="flex items-baseline justify-between gap-3 py-1">
                            <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Deducciones de ley
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-danger)' }}>
                                − {formatCurrency(deductions)}
                            </span>
                        </div>
                    ) : null}

                    {absence > 0 ? (
                        <div className="flex items-baseline justify-between gap-3 py-1">
                            <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Inasistencias
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-danger)' }}>
                                − {formatCurrency(absence)}
                            </span>
                        </div>
                    ) : null}

                    {advances > 0 ? (
                        <div className="flex items-baseline justify-between gap-3 py-1">
                            <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Anticipos
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-danger)' }}>
                                − {formatCurrency(advances)}
                            </span>
                        </div>
                    ) : null}
                </div>

                <div
                    className="mt-2.5 flex items-end justify-between gap-3 pt-2.5"
                    style={{ borderTop: '1px solid var(--emp-row)' }}
                >
                    <div>
                        <p className="emp-kicker">Neto a pagar</p>
                        <p className="text-[24px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                            {formatCurrency(row.net_payment)}
                        </p>
                    </div>
                    <Link
                        href={route('payrolls.payroll-employees.show', [payroll.id, row.id])}
                        className="inline-flex shrink-0 items-center gap-1 text-[12px]"
                        style={{ color: 'var(--emp-accent-on)' }}
                    >
                        Ver ficha completa
                        <ArrowUpRight size={13} />
                    </Link>
                </div>
            </section>

            <AdvanceDiscountList row={row} editors={editors} canEdit={canManageAdjustments} />

            <ManualConceptsPanel payroll={payroll} row={row} concepts={concepts} canManage={canManageAdjustments} />

            {mode !== 'operations' ? (
                <AbsenceList
                    row={row}
                    isHourlyLegal={mode === 'hourly_legal'}
                    editors={editors}
                    canEdit={canEditTime}
                />
            ) : null}
        </div>
    );
}

export default PayrollEmployeePanel;
