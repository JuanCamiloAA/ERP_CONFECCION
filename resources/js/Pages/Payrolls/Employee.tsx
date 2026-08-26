import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, ArrowUUpLeft, FloppyDisk, Printer, Warning } from '@phosphor-icons/react';
import { useState } from 'react';
import { AbsenceList } from '@/Components/Payrolls/AbsenceList';
import { AdvanceDiscountList } from '@/Components/Payrolls/AdvanceDiscountList';
import { LegalBreakdownPanel } from '@/Components/Payrolls/LegalBreakdownPanel';
import { ManualConceptsPanel } from '@/Components/Payrolls/ManualConceptsPanel';
import { liquidationRows } from '@/Components/Payrolls/PayrollEmployeePanel';
import { SessionAdjustTable } from '@/Components/Payrolls/SessionAdjustTable';
import { usePayrollEdits } from '@/Components/Payrolls/usePayrollEdits';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import {
    buildAbsenceConfirmationsFromBaseline,
    buildAdjustments,
    buildAdvanceAdjustments,
    calculatePayload,
    deductionsTotal,
    employeeName,
    hoursFromMinutes,
    modeLabel,
    rowGross,
    sessionMinutes,
    type AbsenceBlock,
    type PayrollStatus,
} from '@/lib/payrolls';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Payroll, PayrollConcept, PayrollEmployee, Production, WorkDaySession } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    payroll: Payroll;
    payrollEmployee: PayrollEmployee;
    workSessions: WorkDaySession[];
    productions: Production[];
    payrollConcepts?: PayrollConcept[];
    absenceBaseline: AbsenceBlock[];
    siblings: {
        position: number;
        total: number;
        previous: { id: number; name: string } | null;
        next: { id: number; name: string } | null;
    };
    periodicityName?: string | null;
}

const TONE: Record<string, string> = {
    text: 'var(--emp-text)',
    muted: 'var(--emp-muted)',
    danger: 'var(--emp-danger)',
    accent: 'var(--emp-accent-on)',
};

const PRODUCTION_GRID = '96px minmax(0,1fr) minmax(0,1fr) 84px 104px 96px';

export default function PayrollEmployeePage({
    payroll,
    payrollEmployee: row,
    workSessions,
    productions,
    payrollConcepts = [],
    absenceBaseline,
    siblings,
    periodicityName = null,
}: Props) {
    const perms = usePermissions();
    const editors = usePayrollEdits();
    const [confirmSave, setConfirmSave] = useState(false);

    const status = payroll.status as PayrollStatus;
    const canEditTime = status === 'calculado' && perms.can('payrolls.show.edit_time');
    const canManageAdjustments = status === 'calculado' && perms.can('payrolls.show.manage_adjustments');
    const canRecalculate = status === 'calculado' && perms.can('payrolls.show.calculate');

    const mode = row.employee?.payroll_mode ?? 'operations';
    const alerts = row.overtime_limit_alerts ?? [];
    const breakdown = row.legal_hours_breakdown ?? null;
    const minutes = sessionMinutes(workSessions);
    const gross = rowGross(row);
    const deductions = deductionsTotal(row);
    const absence = Number(row.absence_discount_total ?? 0);
    const advances = Number(row.advances_discount ?? 0);
    const name = employeeName(row);
    const units = productions.reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);

    const ordinaryMinutes = (breakdown?.ordinary_day_minutes ?? 0) + (breakdown?.ordinary_night_minutes ?? 0);
    const extraMinutes =
        (breakdown?.overtime_day_minutes ?? 0) +
        (breakdown?.overtime_night_minutes ?? 0) +
        (breakdown?.overtime_sunday_holiday_day_minutes ?? 0) +
        (breakdown?.overtime_sunday_holiday_night_minutes ?? 0);
    const sundayMinutes =
        (breakdown?.sunday_holiday_day_minutes ?? 0) + (breakdown?.sunday_holiday_night_minutes ?? 0);

    const grossCell = {
        label: 'Bruto devengado',
        value: formatCurrency(gross),
        meta: `neto ${formatCurrency(row.net_payment)}`,
    };

    /*
     * Cada modalidad se mide con lo suyo. Repetir las celdas de la jornada legal en salario
     * diario llenaba la franja de «0,0 h» que no significan nada: en esa modalidad no hay
     * clasificacion de horas, se paga el dia.
     */
    const cells =
        mode === 'operations'
            ? [
                  { label: 'Registros', value: formatNumber(productions.length), meta: 'de producción' },
                  { label: 'Unidades', value: formatNumber(units), meta: 'producidas' },
                  { label: 'Producido', value: formatCurrency(row.production_total), meta: 'pago por operación' },
                  { label: 'Conceptos', value: formatCurrency(row.adjustments_subtotal ?? 0), meta: 'manuales' },
                  grossCell,
              ]
            : mode === 'fixed_daily'
              ? [
                    {
                        label: 'Jornadas',
                        value: formatNumber(workSessions.length),
                        meta: `${formatNumber(minutes)} min · ${hoursFromMinutes(minutes)} h`,
                    },
                    {
                        label: 'Días liquidados',
                        value: formatNumber((row.validated_work_days ?? []).length),
                        meta: 'con jornada válida',
                    },
                    { label: 'Jornada', value: formatCurrency(row.daily_work_subtotal ?? 0), meta: 'salario diario' },
                    { label: 'Conceptos', value: formatCurrency(row.adjustments_subtotal ?? 0), meta: 'manuales' },
                    grossCell,
                ]
              : [
                  {
                      label: 'Jornadas',
                      value: formatNumber(workSessions.length),
                      meta: `${formatNumber(minutes)} min · ${hoursFromMinutes(minutes)} h`,
                  },
                  {
                      label: 'Ordinarias',
                      value: `${hoursFromMinutes(ordinaryMinutes)} h`,
                      meta: `${hoursFromMinutes(breakdown?.ordinary_night_minutes ?? 0)} h nocturnas`,
                  },
                  {
                      label: 'Extras',
                      value: `${hoursFromMinutes(extraMinutes)} h`,
                      meta: alerts.length > 0 ? 'sobre el tope legal' : 'dentro del tope',
                      tone: alerts.length > 0 ? 'danger' : 'accent',
                  },
                  { label: 'Dom / festivo', value: `${hoursFromMinutes(sundayMinutes)} h`, meta: 'con recargo' },
                  { label: 'Bruto devengado', value: formatCurrency(gross), meta: `neto ${formatCurrency(row.net_payment)}` },
              ];

    const save = () => {
        setConfirmSave(false);

        const payload = calculatePayload(
            buildAdjustments(editors.sessionEdits, { [String(row.employee_id)]: workSessions }),
            buildAbsenceConfirmationsFromBaseline(editors.absenceEdits, absenceBaseline),
            buildAdvanceAdjustments(editors.advanceEdits, [row]),
        );

        router.post(route('payrolls.calculate', payroll.id), payload as never, {
            onSuccess: () => editors.reset(),
        });
    };

    const navButton = (target: { id: number; name: string } | null, direction: 'previous' | 'next') =>
        target ? (
            <Link
                href={route('payrolls.payroll-employees.show', [payroll.id, target.id])}
                className="emp-btn emp-btn-sm"
                aria-label={`${direction === 'previous' ? 'Empleado anterior' : 'Empleado siguiente'}: ${target.name}`}
            >
                {direction === 'previous' ? <ArrowLeft size={14} /> : null}
                {direction === 'previous' ? 'Anterior' : 'Siguiente'}
                {direction === 'next' ? <ArrowRight size={14} /> : null}
            </Link>
        ) : null;

    return (
        <AppLayout title={name}>
            <Head title={`${name} · ${payroll.name}`} />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] lg:-m-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('payrolls.index')} className="hover:underline">
                                Nómina
                            </Link>
                            <span aria-hidden="true">›</span>
                            <Link href={route('payrolls.show', payroll.id)} className="hover:underline">
                                {payroll.name}
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>{name}</span>
                        </p>

                        <div className="mt-2 flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[20px] capitalize"
                                style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                            >
                                {name.charAt(0)}
                            </span>
                            <div className="min-w-0">
                                <h1 className="truncate text-[24px] capitalize" style={{ color: 'var(--emp-text)' }}>
                                    {name}
                                </h1>
                                <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                    {row.employee?.document_type ?? 'CC'} {row.employee?.document_number ?? '—'}
                                    {row.employee?.hire_date ? ` · ingreso ${formatDate(row.employee.hire_date)}` : ''}
                                    {` · ${formatDate(payroll.period_start)} – ${formatDate(payroll.period_end)}`}
                                    {periodicityName ? ` · ${periodicityName}` : ''}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="emp-pill emp-pill-accent">{modeLabel(mode)}</span>
                                    {row.employee?.base_salary ? (
                                        <span className="emp-pill">
                                            Salario base {formatCurrency(row.employee.base_salary)}
                                        </span>
                                    ) : null}
                                    {row.employee?.bank?.name ? (
                                        <span className="emp-pill">
                                            {row.employee.bank.name}
                                            {row.employee.bank_account_number ? ` · ${row.employee.bank_account_number}` : ''}
                                        </span>
                                    ) : null}
                                    {alerts.length > 0 ? (
                                        <span className="emp-pill emp-pill-warn">
                                            <Warning size={11} />
                                            Tope excedido
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {siblings.total > 1 ? (
                            <span className="text-[12px] max-sm:hidden" style={{ color: 'var(--emp-subtle)' }}>
                                {siblings.position} de {siblings.total}
                            </span>
                        ) : null}
                        {navButton(siblings.previous, 'previous')}
                        {navButton(siblings.next, 'next')}
                        <a
                            href={route('payrolls.payroll-employees.receipt', [payroll.id, row.id])}
                            target="_blank"
                            rel="noreferrer"
                            className="emp-btn emp-btn-sm emp-btn-primary"
                        >
                            <Printer size={14} />
                            Comprobante
                        </a>
                    </div>
                </div>

                {/* ------------------------------------------------- franja */}
                <div className="emp-card mt-4 grid grid-cols-2 gap-[14px] p-[14px_18px] sm:grid-cols-3 lg:grid-cols-5">
                    {cells.map((cell) => (
                        <div key={cell.label} className="min-w-0">
                            <p className="emp-kicker">{cell.label}</p>
                            <p
                                className="mt-1 truncate text-[18px] tabular-nums"
                                style={{ color: TONE[(cell as { tone?: string }).tone ?? 'text'] }}
                            >
                                {cell.value}
                            </p>
                            <p className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {cell.meta}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    {/* ------------------------------------------- izquierda */}
                    <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
                        {mode !== 'operations' ? (
                            <section className="emp-card p-[15px_16px]">
                                <p className="emp-kicker">Jornadas registradas</p>
                                <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    {canEditTime
                                        ? 'Ajusta los minutos y anota el motivo; se aplican al guardar y recalcular.'
                                        : 'Los ajustes de jornada solo se editan con la nómina en estado calculado.'}
                                </p>
                                <div className="mt-2.5">
                                    <SessionAdjustTable
                                        employeeId={row.employee_id}
                                        sessions={workSessions}
                                        editors={editors}
                                        canEdit={canEditTime}
                                    />
                                </div>
                            </section>
                        ) : null}

                        {mode === 'hourly_legal' && breakdown ? (
                            <LegalBreakdownPanel breakdown={breakdown} alerts={alerts} />
                        ) : null}

                        {/*
                          * En modalidad por jornada la produccion no se paga por operacion, pero se
                          * sigue mostrando: es la referencia de lo que hizo la persona en el periodo
                          * y estaba en el detalle anterior.
                          */}
                        {mode === 'operations' || productions.length > 0 ? (
                            <section className="emp-card p-[15px_16px]">
                                <p className="emp-kicker">Producción del periodo</p>

                                {productions.length === 0 ? (
                                    <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                        No hay producción liquidable en este periodo.
                                    </p>
                                ) : (
                                    <>
                                        <div className="mt-2.5 hidden lg:block">
                                            <div
                                                className="grid items-center gap-2.5 px-2 pb-2"
                                                style={{
                                                    gridTemplateColumns: PRODUCTION_GRID,
                                                    borderBottom: '1px solid var(--emp-border)',
                                                }}
                                            >
                                                {['Fecha', 'Referencia', 'Operación', 'Cantidad', 'Valor', 'Estado'].map(
                                                    (column, index) => (
                                                        <span
                                                            key={column}
                                                            className={`text-[11px] uppercase tracking-[0.09em] ${
                                                                index === 3 || index === 4 ? 'text-right' : ''
                                                            }`}
                                                            style={{ color: 'var(--emp-subtle)' }}
                                                        >
                                                            {column}
                                                        </span>
                                                    ),
                                                )}
                                            </div>

                                            {productions.map((production) => (
                                                <div
                                                    key={production.id}
                                                    className="emp-row-sep grid items-center gap-2.5 px-2 py-2"
                                                    style={{ gridTemplateColumns: PRODUCTION_GRID }}
                                                >
                                                    <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                        {formatDate(production.date)}
                                                    </span>
                                                    <span className="truncate text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                                        {production.reference
                                                            ? `${production.reference.code} · ${production.reference.name}`
                                                            : '—'}
                                                    </span>
                                                    <span className="truncate text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                                        {production.operation?.name ?? '—'}
                                                    </span>
                                                    <span className="text-right text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                        {formatNumber(production.quantity)}
                                                    </span>
                                                    <span className="text-right text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                        {formatCurrency(production.total_value)}
                                                    </span>
                                                    <span className="text-[11px] capitalize" style={{ color: 'var(--emp-subtle)' }}>
                                                        {production.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-2.5 flex flex-col gap-2 lg:hidden">
                                            {productions.map((production) => (
                                                <div
                                                    key={production.id}
                                                    className="rounded-[10px] p-2.5"
                                                    style={{
                                                        border: '1px solid var(--emp-border)',
                                                        backgroundColor: 'var(--emp-field-alt)',
                                                    }}
                                                >
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                            {formatDate(production.date)}
                                                        </span>
                                                        <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                            {formatCurrency(production.total_value)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                                        {production.reference
                                                            ? `${production.reference.code} · ${production.reference.name}`
                                                            : '—'}{' '}
                                                        · {production.operation?.name ?? '—'} ·{' '}
                                                        {formatNumber(production.quantity)} u · {production.status}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {Number(row.production_total) === 0 ? (
                                            <p className="emp-help">
                                                Registro informativo: en esta modalidad la producción no se paga por
                                                operación, por eso no suma al devengado.
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </section>
                        ) : null}
                    </div>

                    {/* -------------------------------------------- derecha */}
                    <aside className="flex w-full flex-col gap-3 lg:w-[360px] lg:shrink-0">
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

                            <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--emp-row)' }}>
                                <p className="emp-kicker">Neto a pagar</p>
                                <p className="text-[26px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                                    {formatCurrency(row.net_payment)}
                                </p>
                            </div>
                        </section>

                        <ManualConceptsPanel
                            payroll={payroll}
                            row={row}
                            concepts={payrollConcepts}
                            canManage={canManageAdjustments}
                        />

                        <AdvanceDiscountList row={row} editors={editors} canEdit={canManageAdjustments} />

                        {mode !== 'operations' ? (
                            <AbsenceList
                                row={row}
                                isHourlyLegal={mode === 'hourly_legal'}
                                editors={editors}
                                canEdit={canEditTime}
                            />
                        ) : null}

                        {canRecalculate ? (
                            <div className="flex items-center gap-2 max-lg:hidden">
                                <button
                                    type="button"
                                    onClick={editors.reset}
                                    disabled={! editors.dirty}
                                    className="emp-btn"
                                >
                                    <ArrowUUpLeft size={15} />
                                    Descartar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmSave(true)}
                                    className="emp-btn emp-btn-primary flex-1"
                                >
                                    <FloppyDisk size={15} />
                                    Guardar y recalcular
                                </button>
                            </div>
                        ) : null}
                    </aside>
                </div>
            </div>

            {/* Movil: guardar al alcance del pulgar. */}
            {canRecalculate ? (
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button
                        type="button"
                        onClick={editors.reset}
                        disabled={! editors.dirty}
                        aria-label="Descartar los cambios capturados"
                        className="emp-btn w-12 shrink-0 px-0"
                    >
                        <ArrowUUpLeft size={17} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmSave(true)}
                        className="emp-btn emp-btn-primary flex-1"
                    >
                        <FloppyDisk size={17} />
                        Guardar y recalcular
                    </button>
                </div>
            ) : null}

            <ConfirmDialog
                open={confirmSave}
                onClose={() => setConfirmSave(false)}
                onConfirm={save}
                title="Guardar y recalcular"
                message={
                    editors.dirty
                        ? 'Se aplicaran los ajustes capturados en esta ficha y se recalculara toda la nomina del periodo.'
                        : 'No hay cambios capturados. Se recalculara la nomina del periodo con la produccion y las jornadas actuales.'
                }
                confirmText="Guardar y recalcular"
                variant="primary"
            />
        </AppLayout>
    );
}
