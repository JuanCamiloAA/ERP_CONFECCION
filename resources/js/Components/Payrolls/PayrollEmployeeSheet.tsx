import { Link } from '@inertiajs/react';
import { ArrowUpRight, CaretDown, Warning } from '@phosphor-icons/react';
import { AbsenceList } from '@/Components/Payrolls/AbsenceList';
import { AdvanceDiscountList } from '@/Components/Payrolls/AdvanceDiscountList';
import { ManualConceptsPanel } from '@/Components/Payrolls/ManualConceptsPanel';
import { liquidationRows } from '@/Components/Payrolls/PayrollEmployeePanel';
import { SessionAdjustTable } from '@/Components/Payrolls/SessionAdjustTable';
import type { PayrollEditors } from '@/Components/Payrolls/usePayrollEdits';
import { deductionsTotal, employeeName, modeLabel, rowGross } from '@/lib/payrolls';
import { formatCurrency } from '@/lib/utils';
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
    open: boolean;
    onToggle: () => void;
}

const TONE: Record<string, string> = {
    text: 'var(--emp-text)',
    muted: 'var(--emp-muted)',
    danger: 'var(--emp-danger)',
    accent: 'var(--emp-accent-on)',
};

/**
 * Empleado en movil: acordeon en vez de panel lateral.
 *
 * Escribe en el mismo estado que la vista de escritorio (`editors`), asi que capturar un
 * ajuste desde el telefono y recalcular produce exactamente lo mismo. Las jornadas se
 * asoman dos y el resto se consulta en la ficha, que es donde caben.
 */
export function PayrollEmployeeSheet({
    payroll,
    row,
    sessions,
    productions,
    concepts,
    editors,
    canEditTime,
    canManageAdjustments,
    open,
    onToggle,
}: Props) {
    const mode = row.employee?.payroll_mode ?? 'operations';
    const alerts = row.overtime_limit_alerts ?? [];
    const gross = rowGross(row);
    const deductions = deductionsTotal(row);
    const absence = Number(row.absence_discount_total ?? 0);
    const advances = Number(row.advances_discount ?? 0);
    const fichaHref = route('payrolls.payroll-employees.show', [payroll.id, row.id]);

    return (
        <article
            className="overflow-hidden rounded-[14px]"
            style={{
                border: `1px solid ${open ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                backgroundColor: 'var(--emp-surface)',
            }}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center gap-3 p-3 text-left"
            >
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] capitalize" style={{ color: 'var(--emp-text)' }}>
                            {employeeName(row)}
                        </span>
                        {alerts.length > 0 ? (
                            <span className="emp-pill emp-pill-warn shrink-0">
                                <Warning size={11} />
                                Tope
                            </span>
                        ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                        {modeLabel(mode)}
                    </span>
                </span>

                <span className="shrink-0 text-[15px] tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                    {formatCurrency(row.net_payment)}
                </span>

                <CaretDown
                    size={14}
                    style={{
                        color: 'var(--emp-subtle)',
                        transform: open ? 'rotate(180deg)' : undefined,
                        transition: 'transform 120ms ease-out',
                    }}
                />
            </button>

            {open ? (
                <div
                    className="flex flex-col gap-3 p-3"
                    style={{ backgroundColor: 'var(--emp-field-alt)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <section className="emp-card p-[15px_16px]">
                        <p className="emp-kicker">Liquidación</p>
                        <div className="mt-2">
                            {liquidationRows(row).map((line) => (
                                <div key={line.label} className="flex items-baseline justify-between gap-3 py-1">
                                    <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                        {line.label}
                                    </span>
                                    <span className="text-[12.5px] tabular-nums" style={{ color: TONE[line.tone ?? 'text'] }}>
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

                            {[
                                { label: 'Deducciones de ley', value: deductions },
                                { label: 'Inasistencias', value: absence },
                                { label: 'Anticipos', value: advances },
                            ]
                                .filter((line) => line.value > 0)
                                .map((line) => (
                                    <div key={line.label} className="flex items-baseline justify-between gap-3 py-1">
                                        <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                            {line.label}
                                        </span>
                                        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-danger)' }}>
                                            − {formatCurrency(line.value)}
                                        </span>
                                    </div>
                                ))}
                        </div>

                        <div
                            className="mt-2.5 flex items-end justify-between gap-3 pt-2.5"
                            style={{ borderTop: '1px solid var(--emp-row)' }}
                        >
                            <div>
                                <p className="emp-kicker">Neto</p>
                                <p className="text-[22px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                                    {formatCurrency(row.net_payment)}
                                </p>
                            </div>
                            <Link
                                href={fichaHref}
                                className="inline-flex shrink-0 items-center gap-1 text-[12px]"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Ver ficha completa
                                <ArrowUpRight size={13} />
                            </Link>
                        </div>
                    </section>

                    {mode !== 'operations' ? (
                        <section className="emp-card p-[15px_16px]">
                            <p className="emp-kicker">Jornadas</p>
                            <div className="mt-2.5">
                                <SessionAdjustTable
                                    employeeId={row.employee_id}
                                    sessions={sessions}
                                    editors={editors}
                                    canEdit={canEditTime}
                                    limit={2}
                                    moreHref={fichaHref}
                                />
                            </div>
                        </section>
                    ) : null}

                    {mode === 'operations' && productions.length > 0 ? (
                        <section className="emp-card p-[15px_16px]">
                            <p className="emp-kicker">Producción del periodo</p>
                            <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                {productions.length} {productions.length === 1 ? 'registro' : 'registros'} ·{' '}
                                {formatCurrency(row.production_total)}
                            </p>
                            <Link
                                href={fichaHref}
                                className="mt-1.5 inline-flex items-center gap-1 text-[12px]"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Ver el detalle
                                <ArrowUpRight size={13} />
                            </Link>
                        </section>
                    ) : null}

                    <AdvanceDiscountList row={row} editors={editors} canEdit={canManageAdjustments} />

                    <ManualConceptsPanel
                        payroll={payroll}
                        row={row}
                        concepts={concepts}
                        canManage={canManageAdjustments}
                    />

                    {mode !== 'operations' ? (
                        <AbsenceList
                            row={row}
                            isHourlyLegal={mode === 'hourly_legal'}
                            editors={editors}
                            canEdit={canEditTime}
                        />
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}

export default PayrollEmployeeSheet;
