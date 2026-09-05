import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, FileText, PaperPlaneTilt, Printer } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { PayrollActionIcon, PayrollStatePill } from '@/Components/Payrolls/PayrollFlowBar';
import { PayrollFlowHeader } from '@/Components/Payrolls/PayrollFlowHeader';
import {
    PayrollEmployeeList,
    type EmployeeModeFilter,
} from '@/Components/Payrolls/PayrollEmployeeList';
import { PayrollEmployeePanel } from '@/Components/Payrolls/PayrollEmployeePanel';
import { PayrollEmployeeSheet } from '@/Components/Payrolls/PayrollEmployeeSheet';
import { PayrollTotalsStrip, type PayrollEmployeeTotals } from '@/Components/Payrolls/PayrollTotalsStrip';
import { SendReceiptsDialog } from '@/Components/Payrolls/SendReceiptsDialog';
import { usePayrollEdits } from '@/Components/Payrolls/usePayrollEdits';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import {
    buildAbsenceConfirmations,
    buildAdjustments,
    buildAdvanceAdjustments,
    calculatePayload,
    nextAction,
    type PayrollStatus,
} from '@/lib/payrolls';
import { formatDate, formatNumber, formatRelativeDate } from '@/lib/utils';
import type {
    PaginatedResponse,
    Payroll,
    PayrollConcept,
    PayrollEmployee,
    Production,
    WorkDaySession,
} from '@/types';
import '../../../css/module-ui.css';

interface Props {
    payroll: Payroll & {
        updated_at?: string;
        creator?: { id: number; name: string; last_name: string | null } | null;
    };
    payrollEmployees: PaginatedResponse<PayrollEmployee>;
    payrollEmployeeTotals: PayrollEmployeeTotals;
    workSessionsByEmployee: Record<string, WorkDaySession[]>;
    productionsByEmployee?: Record<string, Production[]>;
    payrollConcepts?: PayrollConcept[];
    periodicityName?: string | null;
}

export default function PayrollShow({
    payroll,
    payrollEmployees,
    payrollEmployeeTotals,
    workSessionsByEmployee = {},
    productionsByEmployee = {},
    payrollConcepts = [],
    periodicityName = null,
}: Props) {
    const perms = usePermissions();
    const editors = usePayrollEdits();

    const [confirmAction, setConfirmAction] = useState<null | 'calculate' | 'approve' | 'pay'>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<EmployeeModeFilter>('all');
    const [openSheet, setOpenSheet] = useState<number | null>(null);
    const [sendOpen, setSendOpen] = useState(false);

    const rows = payrollEmployees.data;
    const status = payroll.status as PayrollStatus;
    const action = nextAction(status);

    /** El comprobante se manda cuando la nomina ya esta pagada; antes las cifras cambian. */
    const canSendReceipts =
        status === 'pagado' && rows.length > 0 && perms.can('payrolls.show.send_receipts');

    /** Ajustes y conceptos solo se tocan con la nomina calculada; despues de aprobar, no. */
    const canEditTime = status === 'calculado' && perms.can('payrolls.show.edit_time');
    const canManageAdjustments = status === 'calculado' && perms.can('payrolls.show.manage_adjustments');

    const selected = useMemo(
        () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
        [rows, selectedId],
    );

    const sessionsOf = (row: PayrollEmployee) =>
        row.employee_id ? workSessionsByEmployee[String(row.employee_id)] ?? [] : [];
    const productionsOf = (row: PayrollEmployee) =>
        row.employee_id ? productionsByEmployee[String(row.employee_id)] ?? [] : [];

    const handleAction = (nextStep: 'calculate' | 'approve' | 'pay') => {
        const url = {
            calculate: route('payrolls.calculate', payroll.id),
            approve: route('payrolls.approve', payroll.id),
            pay: route('payrolls.pay', payroll.id),
        }[nextStep];

        if (nextStep === 'calculate') {
            const payload = calculatePayload(
                buildAdjustments(editors.sessionEdits, workSessionsByEmployee),
                buildAbsenceConfirmations(editors.absenceEdits, rows),
                buildAdvanceAdjustments(editors.advanceEdits, rows),
            );

            router.post(url, payload as never, {
                onSuccess: () => editors.reset(),
                onFinish: () => setConfirmAction(null),
            });

            return;
        }

        router.post(url, {}, { onFinish: () => setConfirmAction(null) });
    };

    const calcMessage = editors.dirty
        ? 'Se aplicaran los ajustes de jornada, anticipos e inasistencias que hayas capturado antes de calcular.'
        : 'Esto actualizara el calculo por produccion y jornadas; los ajustes por conceptos manuales que ya registraste se mantienen.';

    const headerMeta = [
        `${formatDate(payroll.period_start)} – ${formatDate(payroll.period_end)}`,
        periodicityName ?? payroll.type,
        `${formatNumber(payrollEmployeeTotals.employee_count)} ${
            payrollEmployeeTotals.employee_count === 1 ? 'empleado' : 'empleados'
        }`,
        `actualizada ${formatRelativeDate(payroll.updated_at ?? payroll.created_at)}`,
        payroll.creator ? `creada por ${`${payroll.creator.name} ${payroll.creator.last_name ?? ''}`.trim()}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const emptyState = (
        <div className="emp-card mt-5 p-8 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
            Aún no se ha calculado la nómina. Usa «{action.label}» para procesar producción, jornadas y recargos del
            periodo.
        </div>
    );

    return (
        <AppLayout title={payroll.name}>
            <Head title={payroll.name} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-28 pt-5 sm:px-[34px] sm:pb-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            href={route('payrolls.index')}
                            className="emp-kicker inline-flex items-center gap-1.5 hover:underline"
                        >
                            <ArrowLeft size={13} />
                            Nómina
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2.5">
                            <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                                {payroll.name}
                            </h1>
                            <PayrollStatePill status={status} />
                        </div>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            {headerMeta}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={route('payrolls.export', payroll.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="emp-btn emp-btn-sm"
                        >
                            <Printer size={15} />
                            Imprimir general
                        </a>
                        <a
                            href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                            target="_blank"
                            rel="noreferrer"
                            className="emp-btn emp-btn-sm"
                        >
                            <FileText size={15} />
                            Imprimir detallado
                        </a>
                        {/* Solo con la nomina pagada: antes de eso las cifras todavia cambian
                            y el comprobante que reciba el empleado quedaria desactualizado. */}
                        {canSendReceipts && (
                            <button
                                type="button"
                                onClick={() => setSendOpen(true)}
                                className="emp-btn emp-btn-sm emp-btn-primary"
                            >
                                <PaperPlaneTilt size={15} />
                                Enviar comprobantes
                            </button>
                        )}
                    </div>
                </div>

                {/* ------------------------------------------------------ flujo */}
                <div className="max-lg:hidden">
                    <PayrollFlowHeader payroll={payroll} onAction={setConfirmAction} />
                </div>
                <div className="lg:hidden">
                    <PayrollFlowHeader payroll={payroll} onAction={setConfirmAction} compact />
                </div>

                <PayrollTotalsStrip totals={payrollEmployeeTotals} net={payroll.total_amount} />

                {rows.length === 0 ? (
                    emptyState
                ) : (
                    <>
                        {/* ------------------------------------ maestro-detalle */}
                        <div className="mt-5 hidden items-start gap-[26px] lg:flex">
                            <div className="min-w-0 flex-1">
                                <PayrollEmployeeList
                                    rows={rows}
                                    selectedId={selected?.id ?? null}
                                    onSelect={setSelectedId}
                                    search={search}
                                    onSearch={setSearch}
                                    mode={mode}
                                    onMode={setMode}
                                    sessionsByEmployee={workSessionsByEmployee}
                                    productionsByEmployee={productionsByEmployee}
                                />
                            </div>

                            <aside className="w-[400px] shrink-0 lg:sticky lg:top-[84px] lg:self-start">
                                {selected ? (
                                    <PayrollEmployeePanel
                                        payroll={payroll}
                                        row={selected}
                                        sessions={sessionsOf(selected)}
                                        productions={productionsOf(selected)}
                                        concepts={payrollConcepts}
                                        editors={editors}
                                        canEditTime={canEditTime}
                                        canManageAdjustments={canManageAdjustments}
                                    />
                                ) : (
                                    <EmployeeAsideCard title="Empleado">
                                        <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                            Toca un empleado para ver su liquidación.
                                        </p>
                                    </EmployeeAsideCard>
                                )}
                            </aside>
                        </div>

                        {/* ------------------------------------------- movil */}
                        <div className="mt-5 lg:hidden">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar empleado..."
                                aria-label="Buscar empleado en la nómina"
                                className="emp-field"
                            />

                            <div className="emp-seg mt-2.5">
                                {(
                                    [
                                        { value: 'all', label: 'Todos' },
                                        { value: 'operations', label: 'Operaciones' },
                                        { value: 'fixed_daily', label: 'Jornada' },
                                        { value: 'hourly_legal', label: 'Horas' },
                                    ] as { value: EmployeeModeFilter; label: string }[]
                                ).map((segment) => (
                                    <button
                                        key={segment.value}
                                        type="button"
                                        onClick={() => setMode(segment.value)}
                                        className={`emp-seg-item ${mode === segment.value ? 'emp-seg-on' : ''}`}
                                    >
                                        {segment.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-3 flex flex-col gap-2">
                                {rows
                                    .filter((row) => {
                                        if (mode !== 'all' && (row.employee?.payroll_mode ?? 'operations') !== mode) {
                                            return false;
                                        }
                                        const term = search.trim().toLowerCase();
                                        if (term === '') return true;

                                        return `${row.employee?.first_name ?? ''} ${row.employee?.last_name ?? ''} ${
                                            row.employee?.document_number ?? ''
                                        }`
                                            .toLowerCase()
                                            .includes(term);
                                    })
                                    .map((row) => (
                                        <PayrollEmployeeSheet
                                            key={row.id}
                                            payroll={payroll}
                                            row={row}
                                            sessions={sessionsOf(row)}
                                            productions={productionsOf(row)}
                                            concepts={payrollConcepts}
                                            editors={editors}
                                            canEditTime={canEditTime}
                                            canManageAdjustments={canManageAdjustments}
                                            open={openSheet === row.id}
                                            onToggle={() => setOpenSheet(openSheet === row.id ? null : row.id)}
                                        />
                                    ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Movil: la accion del estado, al alcance del pulgar. */}
            <div
                className="emp-form fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
                style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
            >
                <a
                    href={route('payrolls.export', payroll.id)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Imprimir informe general"
                    className="emp-btn w-12 shrink-0 px-0"
                >
                    <Printer size={17} />
                </a>

                {canSendReceipts && (
                    <button
                        type="button"
                        onClick={() => setSendOpen(true)}
                        aria-label="Enviar comprobantes por correo"
                        className="emp-btn w-12 shrink-0 px-0"
                    >
                        <PaperPlaneTilt size={17} />
                    </button>
                )}

                {action.action === 'export' ? (
                    <a
                        href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                        target="_blank"
                        rel="noreferrer"
                        className="emp-btn emp-btn-primary flex-1"
                    >
                        <PayrollActionIcon name={action.icon} size={17} />
                        {action.label}
                    </a>
                ) : perms.can(action.permission) ? (
                    <button
                        type="button"
                        onClick={() => setConfirmAction(action.action as 'calculate' | 'approve' | 'pay')}
                        className="emp-btn emp-btn-primary flex-1"
                    >
                        <PayrollActionIcon name={action.icon} size={17} />
                        {action.label}
                    </button>
                ) : null}
            </div>

            <ConfirmDialog
                open={confirmAction === 'calculate'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => handleAction('calculate')}
                title="Calcular nomina"
                message={calcMessage}
                confirmText="Calcular"
                variant="primary"
            />

            <ConfirmDialog
                open={confirmAction === 'approve'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => handleAction('approve')}
                title="Aprobar nomina"
                message="Despues de aprobada solo podra marcarse como pagada. No se podra recalcular."
                confirmText="Aprobar"
                variant="success"
            />

            <ConfirmDialog
                open={confirmAction === 'pay'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => handleAction('pay')}
                title="Marcar como pagada"
                message="Se marcaran los pagos a empleados y se descontaran los anticipos. Esta accion no se puede deshacer."
                confirmText="Marcar pagada"
                variant="success"
            />

            {canSendReceipts && (
                <SendReceiptsDialog
                    open={sendOpen}
                    onClose={() => setSendOpen(false)}
                    payroll={payroll}
                    rows={rows}
                />
            )}
        </AppLayout>
    );
}
