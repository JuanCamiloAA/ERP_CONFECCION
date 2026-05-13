import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CalculatorIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    PencilSquareIcon,
    PlusIcon,
    PrinterIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { StatCard } from '@/Components/UI/StatCard';
import { Table, TableBody, TableCell, TableFoot, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { Textarea } from '@/Components/UI/Textarea';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Payroll, PayrollConcept, PayrollEmployee, PayrollEmployeeAdjustment, Production, WorkDaySession, PaginatedResponse } from '@/types';

interface PayrollEmployeeTotals {
    employee_count: number;
    total_production: number;
    total_daily: number;
    total_adjustments: number;
    total_gross: number;
    total_advances: number;
    total_deductions: number;
    show_daily_column: boolean;
}

interface Props {
    payroll: Payroll;
    payrollEmployees: PaginatedResponse<PayrollEmployee>;
    payrollEmployeeTotals: PayrollEmployeeTotals;
    workSessionsByEmployee: Record<string, WorkDaySession[]>;
    productionsByEmployee?: Record<string, Production[]>;
    payrollConcepts?: PayrollConcept[];
}

const statusVariant: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
    borrador: 'neutral',
    calculado: 'info',
    aprobado: 'warning',
    pagado: 'success',
};

function rowGross(row: PayrollEmployee): number {
    return (
        Number(row.production_total) +
        Number(row.daily_work_subtotal ?? 0) +
        Number(row.adjustments_subtotal ?? 0)
    );
}

function editKey(employeeId: number, sessionId: number): string {
    return `${employeeId}:${sessionId}`;
}

function buildAdjustments(
    edits: Record<string, { duration_minutes: string; reason: string }>,
    sessionsByEmp: Record<string, WorkDaySession[]>,
): { employee_id: number; sessions: { session_id: number; duration_minutes?: number; reason?: string }[] }[] {
    const byEmp: Record<number, { session_id: number; duration_minutes?: number; reason?: string }[]> = {};

    for (const [key, edit] of Object.entries(edits)) {
        const parts = key.split(':');
        const employeeId = Number(parts[0]);
        const sessionId = Number(parts[1]);
        if (!employeeId || !sessionId) continue;

        const list = sessionsByEmp[String(employeeId)] ?? [];
        const session = list.find((s) => s.id === sessionId);
        if (!session?.clock_out_at) continue;

        const origDm = Number(session.duration_minutes ?? 0);
        const rawDm = edit.duration_minutes.trim();
        const nextDm = rawDm === '' ? origDm : Number(rawDm);
        const durationChanged = rawDm !== '' && !Number.isNaN(nextDm) && nextDm !== origDm;
        const reason = edit.reason.trim();
        if (!durationChanged && !reason) continue;
        if (rawDm !== '' && Number.isNaN(Number(rawDm))) continue;

        const payload: { session_id: number; duration_minutes?: number; reason?: string } = { session_id: sessionId };
        if (durationChanged) payload.duration_minutes = Number(rawDm);
        if (reason) payload.reason = reason;

        byEmp[employeeId] = byEmp[employeeId] ?? [];
        byEmp[employeeId].push(payload);
    }

    return Object.entries(byEmp).map(([employee_id, sessions]) => ({
        employee_id: Number(employee_id),
        sessions,
    }));
}

export default function PayrollShow({
    payroll,
    payrollEmployees,
    payrollEmployeeTotals,
    workSessionsByEmployee = {},
    productionsByEmployee = {},
    payrollConcepts = [],
}: Props) {
    const perms = usePermissions();
    const [confirmAction, setConfirmAction] = useState<null | 'calculate' | 'approve' | 'pay'>(null);
    const [confirmDeleteAdj, setConfirmDeleteAdj] = useState<null | { pe: PayrollEmployee; adj: PayrollEmployeeAdjustment }>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [sessionEdits, setSessionEdits] = useState<Record<string, { duration_minutes: string; reason: string }>>({});
    const [adjModal, setAdjModal] = useState<null | { payrollEmployee: PayrollEmployee; adjustment?: PayrollEmployeeAdjustment }>(null);
    const [adjConceptId, setAdjConceptId] = useState('');
    const [adjAmount, setAdjAmount] = useState('');
    const [adjNotes, setAdjNotes] = useState('');
    const [adjSaving, setAdjSaving] = useState(false);

    const rows = payrollEmployees.data;
    const employeeCount = payrollEmployeeTotals.employee_count;
    const canAdjustBeforeCalc = payroll.status === 'calculado' && perms.can('payrolls.show.edit_time');
    const canManageConceptAdjustments =
        payroll.status === 'calculado' && perms.can('payrolls.show.manage_adjustments');

    const totalProduction = payrollEmployeeTotals.total_production;
    const totalDaily = payrollEmployeeTotals.total_daily;
    const totalAdjustments = payrollEmployeeTotals.total_adjustments;
    const totalGross = payrollEmployeeTotals.total_gross;
    const totalAdvances = payrollEmployeeTotals.total_advances;
    const totalDeductions = payrollEmployeeTotals.total_deductions;

    const showDailyColumn = payrollEmployeeTotals.show_daily_column;
    const detailColSpan = 9 + (showDailyColumn ? 1 : 0);

    useEffect(() => {
        if (!canManageConceptAdjustments || rows.length === 0) {
            return;
        }
        setExpanded((prev) => {
            const next = new Set(prev);
            rows.forEach((r) => next.add(r.id));
            return next;
        });
    }, [canManageConceptAdjustments, payroll.id, rows]);

    useEffect(() => {
        if (!adjModal) {
            setAdjConceptId('');
            setAdjAmount('');
            setAdjNotes('');
            return;
        }
        if (adjModal.adjustment) {
            setAdjConceptId(String(adjModal.adjustment.payroll_concept_id));
            setAdjAmount(String(adjModal.adjustment.amount));
            setAdjNotes(adjModal.adjustment.notes ?? '');
        } else {
            setAdjConceptId(payrollConcepts[0]?.id ? String(payrollConcepts[0].id) : '');
            setAdjAmount('');
            setAdjNotes('');
        }
    }, [adjModal, payrollConcepts]);

    const conceptSelectOptions = useMemo(
        () =>
            payrollConcepts.map((c) => ({
                value: String(c.id),
                label: c.code ? `${c.name} (${c.code})` : c.name,
            })),
        [payrollConcepts],
    );

    const submitAdjustment = () => {
        if (!adjModal) return;
        const pe = adjModal.payrollEmployee;
        if (!adjModal.adjustment) {
            if (!adjConceptId || !adjAmount.trim()) return;
            setAdjSaving(true);
            router.post(
                route('payrolls.payroll-employees.adjustments.store', [payroll.id, pe.id]),
                {
                    payroll_concept_id: Number(adjConceptId),
                    amount: Number(adjAmount.replace(',', '.')),
                    notes: adjNotes.trim() || null,
                },
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setAdjSaving(false);
                        setAdjModal(null);
                    },
                },
            );
            return;
        }
        setAdjSaving(true);
        router.put(
            route('payrolls.payroll-employees.adjustments.update', [payroll.id, pe.id, adjModal.adjustment.id]),
            {
                amount: Number(adjAmount.replace(',', '.')),
                notes: adjNotes.trim() || null,
            },
            {
                preserveScroll: true,
                onFinish: () => {
                    setAdjSaving(false);
                    setAdjModal(null);
                },
            },
        );
    };

    const deleteAdjustment = () => {
        if (!confirmDeleteAdj) return;
        const { pe, adj } = confirmDeleteAdj;
        setConfirmDeleteAdj(null);
        router.delete(route('payrolls.payroll-employees.adjustments.destroy', [payroll.id, pe.id, adj.id]), {
            preserveScroll: true,
        });
    };

    const adjustmentsPanel = (row: PayrollEmployee) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                    className="text-xs font-semibold uppercase text-slate-500"
                    title="Los conceptos parametrizables estan en la seccion Conceptos de nomina del menu."
                >
                    Ajustes y conceptos manuales
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    {perms.can('payroll_concepts.index.view') ? (
                        <Link
                            href={route('payroll-concepts.index')}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                            Ir a conceptos de nomina
                        </Link>
                    ) : null}
                    {canManageConceptAdjustments && payrollConcepts.length > 0 ? (
                        <Button size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setAdjModal({ payrollEmployee: row })}>
                            Agregar concepto
                        </Button>
                    ) : null}
                </div>
            </div>
            {canManageConceptAdjustments && payrollConcepts.length === 0 ? (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                    No hay conceptos activos. Crea al menos uno en Conceptos de nomina para registrar ajustes.
                </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Se suman al bruto devengado (producido y/o jornada) antes de deducciones y anticipos.
            </p>
            {(row.adjustments ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sin ajustes registrados.</p>
            ) : (
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                <th className="py-2 pr-2">Concepto</th>
                                <th className="py-2 pr-2 text-right">Valor</th>
                                <th className="py-2 pr-2">Nota</th>
                                <th className="py-2 pr-2 text-right w-24">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(row.adjustments ?? []).map((a) => (
                                <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-2 pr-2">
                                        {a.payroll_concept?.name ?? `#${a.payroll_concept_id}`}
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(a.amount)}</td>
                                    <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">{a.notes ?? '—'}</td>
                                    <td className="py-2 pr-2 text-right">
                                        {canManageConceptAdjustments ? (
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<PencilSquareIcon className="h-4 w-4" />}
                                                    onClick={() => setAdjModal({ payrollEmployee: row, adjustment: a })}
                                                >
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4" />}
                                                    onClick={() => setConfirmDeleteAdj({ pe: row, adj: a })}
                                                >
                                                    Eliminar
                                                </Button>
                                            </div>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Subtotal ajustes: {formatCurrency(row.adjustments_subtotal ?? 0)}
            </p>
        </div>
    );

    const toggleRow = (payrollEmployeeId: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(payrollEmployeeId)) next.delete(payrollEmployeeId);
            else next.add(payrollEmployeeId);
            return next;
        });
    };

    const handleAction = (action: 'calculate' | 'approve' | 'pay') => {
        const url = {
            calculate: route('payrolls.calculate', payroll.id),
            approve: route('payrolls.approve', payroll.id),
            pay: route('payrolls.pay', payroll.id),
        }[action];

        if (action === 'calculate') {
            const adjustments = buildAdjustments(sessionEdits, workSessionsByEmployee);
            router.post(
                url,
                adjustments.length > 0 ? { employee_adjustments: adjustments } : {},
                { onFinish: () => setConfirmAction(null) },
            );
            return;
        }

        router.post(url, {}, { onFinish: () => setConfirmAction(null) });
    };

    const adjustmentsPreview = useMemo(
        () => buildAdjustments(sessionEdits, workSessionsByEmployee),
        [sessionEdits, workSessionsByEmployee],
    );

    const calcMessage =
        adjustmentsPreview.length > 0 && payroll.status !== 'aprobado' && payroll.status !== 'pagado'
            ? 'Se aplicaran los ajustes de jornada que hayas capturado antes de calcular.'
            : 'Esto actualizara el calculo por produccion y jornadas; los ajustes por conceptos manuales que ya registraste se mantienen.';

    return (
        <AppLayout title={payroll.name}>
            <Head title={payroll.name} />
            <div className="space-y-6">
                <PageHeader
                    title={payroll.name}
                    breadcrumbs={[{ label: 'Nominas', href: route('payrolls.index') }, { label: payroll.name }]}
                    action={
                        <div className="flex flex-wrap gap-2">
                            <Link href={route('payrolls.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Volver
                                </Button>
                            </Link>
                            <a href={route('payrolls.export', payroll.id)} target="_blank" rel="noreferrer">
                                <Button variant="outline" icon={<PrinterIcon className="h-4 w-4" />}>
                                    Imprimir
                                </Button>
                            </a>
                            {payroll.status === 'borrador' || payroll.status === 'calculado' ? (
                                <Can permission="payrolls.show.calculate">
                                    <Button icon={<CalculatorIcon className="h-4 w-4" />} onClick={() => setConfirmAction('calculate')}>
                                        Calcular
                                    </Button>
                                </Can>
                            ) : null}
                            {payroll.status === 'calculado' && (
                                <Can permission="payrolls.show.approve">
                                    <Button
                                        variant="success"
                                        icon={<CheckCircleIcon className="h-4 w-4" />}
                                        onClick={() => setConfirmAction('approve')}
                                    >
                                        Aprobar
                                    </Button>
                                </Can>
                            )}
                            {payroll.status === 'aprobado' && (
                                <Can permission="payrolls.show.pay">
                                    <Button
                                        variant="success"
                                        icon={<BanknotesIcon className="h-4 w-4" />}
                                        onClick={() => setConfirmAction('pay')}
                                    >
                                        Marcar pagada
                                    </Button>
                                </Can>
                            )}
                        </div>
                    }
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    <Card padding="sm">
                        <p className="text-xs uppercase text-slate-500">Periodo</p>
                        <p className="mt-1 text-sm font-semibold">
                            {formatDate(payroll.period_start)} - {formatDate(payroll.period_end)}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-500">{payroll.type}</p>
                    </Card>
                    <Card padding="sm">
                        <p className="text-xs uppercase text-slate-500">Estado</p>
                        <div className="mt-1">
                            <Badge variant={statusVariant[payroll.status]}>{payroll.status}</Badge>
                        </div>
                    </Card>
                    <StatCard title="Total a pagar" value={formatCurrency(payroll.total_amount)} color="indigo" icon={<DocumentTextIcon className="h-5 w-5" />} />
                    <StatCard title="Bruto producido" value={formatCurrency(totalProduction)} color="emerald" />
                    <StatCard title="Bruto por jornada" value={formatCurrency(totalDaily)} color="sky" />
                    <StatCard title="Ajustes manuales" value={formatCurrency(totalAdjustments)} color="amber" />
                    <StatCard title="Empleados" value={employeeCount} color="emerald" />
                </div>

                <Card padding="none">
                    <CardHeader
                        title="Detalle por empleado"
                        description={
                            employeeCount > 0 && payroll.status === 'calculado'
                                ? 'Expande cada fila para ver jornada o produccion. Los ajustes por concepto (bonificaciones, etc.) y la edicion de minutos de jornada solo estan disponibles con la nomina en estado calculado; usa el catalogo «Conceptos de nomina» para conceptos activos.'
                                : employeeCount > 0 && payroll.status === 'borrador'
                                  ? 'En borrador puedes calcular la nomina. Tras calcular, en estado calculado podras ajustar jornadas y añadir conceptos manuales antes de aprobar.'
                                  : undefined
                        }
                        className="px-5 pt-4"
                    />
                    {canManageConceptAdjustments && employeeCount > 0 && payrollConcepts.length === 0 ? (
                        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                            <p className="font-medium">No hay conceptos de nomina activos para esta empresa.</p>
                            <p className="mt-1">
                                Crea al menos uno en{' '}
                                <Link href={route('payroll-concepts.index')} className="font-semibold underline">
                                    Conceptos de nomina
                                </Link>{' '}
                                para poder usar el boton «Agregar concepto» en cada empleado.
                            </p>
                        </div>
                    ) : null}
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader className="w-10" />
                                <TableHeader>Empleado</TableHeader>
                                <TableHeader align="right">Producido</TableHeader>
                                {showDailyColumn ? <TableHeader align="right">Jornada</TableHeader> : null}
                                <TableHeader align="right">Ajustes</TableHeader>
                                <TableHeader align="right">Bruto</TableHeader>
                                <TableHeader align="right">Deducciones</TableHeader>
                                <TableHeader align="right">Anticipos</TableHeader>
                                <TableHeader align="right">Pago neto</TableHeader>
                                <TableHeader align="center">Pagado</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employeeCount === 0 ? (
                                <tr>
                                    <td colSpan={detailColSpan} className="px-4 py-12 text-center text-sm text-slate-500">
                                        Aun no se ha calculado la nomina. Usa &quot;Calcular&quot; para procesarla.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => {
                                    const dedTotal = ((row.deductions as Array<{ amount: number }>) ?? []).reduce(
                                        (s, d) => s + Number(d.amount ?? 0),
                                        0,
                                    );
                                    const isFixed = row.employee?.payroll_mode === 'fixed_daily';
                                    const isOpen = expanded.has(row.id);
                                    const empSessions = row.employee_id ? workSessionsByEmployee[String(row.employee_id)] ?? [] : [];
                                    const empProductions = row.employee_id ? productionsByEmployee[String(row.employee_id)] ?? [] : [];
                                    const showProductionDetail = !isFixed;
                                    const showExpandControl = isFixed || showProductionDetail;

                                    return (
                                        <Fragment key={row.id}>
                                            <TableRow>
                                                <TableCell className="align-top">
                                                    {showExpandControl ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleRow(row.id)}
                                                            className="rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            aria-label={isOpen ? 'Contraer' : 'Expandir'}
                                                        >
                                                            {isOpen ? (
                                                                <ChevronDownIcon className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRightIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium">
                                                        {row.employee?.first_name} {row.employee?.last_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{row.employee?.document_number}</p>
                                                    {row.employee?.payroll_mode ? (
                                                        <Badge variant="neutral" className="mt-1 capitalize">
                                                            {row.employee.payroll_mode === 'fixed_daily' ? 'Salario diario' : 'Por operaciones'}
                                                        </Badge>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell align="right">{formatCurrency(row.production_total)}</TableCell>
                                                {showDailyColumn ? (
                                                    <TableCell align="right">{formatCurrency(row.daily_work_subtotal ?? 0)}</TableCell>
                                                ) : null}
                                                <TableCell align="right" className="tabular-nums text-amber-700 dark:text-amber-400">
                                                    {formatCurrency(row.adjustments_subtotal ?? 0)}
                                                </TableCell>
                                                <TableCell align="right" className="font-medium tabular-nums">
                                                    {formatCurrency(rowGross(row))}
                                                </TableCell>
                                                <TableCell align="right" className="text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(dedTotal)}
                                                </TableCell>
                                                <TableCell align="right" className="text-rose-600 dark:text-rose-400">
                                                    {formatCurrency(row.advances_discount)}
                                                </TableCell>
                                                <TableCell align="right" className="font-bold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(row.net_payment)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Badge variant={row.is_paid ? 'success' : 'warning'}>{row.is_paid ? 'Pagado' : 'Pendiente'}</Badge>
                                                </TableCell>
                                            </TableRow>
                                            {isOpen && isFixed ? (
                                                <TableRow key={`${row.id}-detail-daily`}>
                                                    <TableCell colSpan={detailColSpan} className="bg-slate-50 px-4 py-4 dark:bg-slate-900/40">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase text-slate-500">Jornadas en el periodo</p>
                                                                {empSessions.length === 0 ? (
                                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">No hay sesiones registradas.</p>
                                                                ) : (
                                                                    <div className="mt-2 overflow-x-auto">
                                                                        <table className="w-full min-w-[640px] text-left text-sm">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                                                                    <th className="py-2 pr-2">Fecha</th>
                                                                                    <th className="py-2 pr-2">Estado</th>
                                                                                    <th className="py-2 pr-2">Entrada</th>
                                                                                    <th className="py-2 pr-2">Salida</th>
                                                                                    <th className="py-2 pr-2">Minutos</th>
                                                                                    <th className="py-2 pr-2">Ajuste min.</th>
                                                                                    <th className="py-2 pr-2">Motivo</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {empSessions.map((s) => {
                                                                                    const k = editKey(row.employee_id, s.id);
                                                                                    const canEditRow =
                                                                                        canAdjustBeforeCalc &&
                                                                                        (s.status === 'closed' || s.status === 'adjusted') &&
                                                                                        !!s.clock_out_at;
                                                                                    const edit = sessionEdits[k] ?? {
                                                                                        duration_minutes: String(s.duration_minutes ?? ''),
                                                                                        reason: '',
                                                                                    };
                                                                                    return (
                                                                                        <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                                                                                            <td className="py-2 pr-2">{formatDate(s.work_date)}</td>
                                                                                            <td className="py-2 pr-2 capitalize">{s.status}</td>
                                                                                            <td className="py-2 pr-2">
                                                                                                {s.clock_in_at
                                                                                                    ? new Date(s.clock_in_at).toLocaleString()
                                                                                                    : '—'}
                                                                                            </td>
                                                                                            <td className="py-2 pr-2">
                                                                                                {s.clock_out_at
                                                                                                    ? new Date(s.clock_out_at).toLocaleString()
                                                                                                    : '—'}
                                                                                            </td>
                                                                                            <td className="py-2 pr-2">{s.duration_minutes ?? '—'}</td>
                                                                                            <td className="py-2 pr-2">
                                                                                                {canEditRow ? (
                                                                                                    <Input
                                                                                                        containerClassName="!mb-0"
                                                                                                        type="number"
                                                                                                        min={0}
                                                                                                        value={edit.duration_minutes}
                                                                                                        onChange={(e) =>
                                                                                                            setSessionEdits((prev) => ({
                                                                                                                ...prev,
                                                                                                                [k]: {
                                                                                                                    duration_minutes: e.target.value,
                                                                                                                    reason: prev[k]?.reason ?? '',
                                                                                                                },
                                                                                                            }))
                                                                                                        }
                                                                                                    />
                                                                                                ) : (
                                                                                                    '—'
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-2 pr-2">
                                                                                                {canEditRow ? (
                                                                                                    <Input
                                                                                                        containerClassName="!mb-0"
                                                                                                        placeholder="Opcional"
                                                                                                        value={edit.reason}
                                                                                                        onChange={(e) =>
                                                                                                            setSessionEdits((prev) => ({
                                                                                                                ...prev,
                                                                                                                [k]: {
                                                                                                                    duration_minutes:
                                                                                                                                 prev[k]?.duration_minutes ??
                                                                                                                                 String(s.duration_minutes ?? ''),
                                                                                                                    reason: e.target.value,
                                                                                                                },
                                                                                                            }))
                                                                                                        }
                                                                                                    />
                                                                                                ) : (
                                                                                                    '—'
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {row.validated_work_days && row.validated_work_days.length > 0 ? (
                                                                <div>
                                                                    <p className="text-xs font-semibold uppercase text-slate-500">Liquidacion por dia (calculada)</p>
                                                                    <div className="mt-2 overflow-x-auto">
                                                                        <table className="w-full min-w-[560px] text-left text-sm">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                                                                    <th className="py-2 pr-2">Fecha</th>
                                                                                    <th className="py-2 pr-2">Minutos</th>
                                                                                    <th className="py-2 pr-2">Efectivos</th>
                                                                                    <th className="py-2 pr-2 text-right">Valor dia</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {row.validated_work_days.map((d) => (
                                                                                    <tr key={`${d.work_date}-${d.session_id}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                                        <td className="py-2 pr-2">{formatDate(d.work_date)}</td>
                                                                                        <td className="py-2 pr-2">{d.duration_minutes}</td>
                                                                                        <td className="py-2 pr-2">{d.effective_minutes}</td>
                                                                                        <td className="py-2 pr-2 text-right">{formatCurrency(d.day_earnings)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                            {empProductions.length > 0 ? (
                                                                <div>
                                                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                                                        Operaciones registradas en el periodo
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                        Empleado con nomina por jornada: el devengo sigue la liquidacion por dias arriba. Las operaciones
                                                                        listadas aqui son referencia del periodo (no se suman al total de la columna Producido).
                                                                    </p>
                                                                    <div className="mt-2 overflow-x-auto">
                                                                        <table className="w-full min-w-[720px] text-left text-sm">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                                                                    <th className="py-2 pr-2">Fecha</th>
                                                                                    <th className="py-2 pr-2">Referencia</th>
                                                                                    <th className="py-2 pr-2">Operacion</th>
                                                                                    <th className="py-2 pr-2 text-right">Cantidad</th>
                                                                                    <th className="py-2 pr-2 text-right">Valor</th>
                                                                                    <th className="py-2 pr-2">Estado</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {empProductions.map((p) => (
                                                                                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                                                                                        <td className="py-2 pr-2">{formatDate(p.date)}</td>
                                                                                        <td className="py-2 pr-2">
                                                                                            {p.reference ? `${p.reference.code} · ${p.reference.name}` : '—'}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2">{p.operation?.name ?? '—'}</td>
                                                                                        <td className="py-2 pr-2 text-right tabular-nums">{p.quantity}</td>
                                                                                        <td className="py-2 pr-2 text-right tabular-nums">
                                                                                            {formatCurrency(p.total_value)}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 capitalize">{p.status}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                            {adjustmentsPanel(row)}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                            {isOpen && showProductionDetail ? (
                                                <TableRow key={`${row.id}-detail-prod`}>
                                                    <TableCell colSpan={detailColSpan} className="bg-slate-50 px-4 py-4 dark:bg-slate-900/40">
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                                Produccion por operaciones en el periodo
                                                            </p>
                                                            {empProductions.length === 0 ? (
                                                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                                                    No hay registros de produccion (confirmados o pendientes) en este periodo.
                                                                </p>
                                                            ) : (
                                                                <div className="mt-2 overflow-x-auto">
                                                                    <table className="w-full min-w-[720px] text-left text-sm">
                                                                        <thead>
                                                                            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                                                                <th className="py-2 pr-2">Fecha</th>
                                                                                <th className="py-2 pr-2">Referencia</th>
                                                                                <th className="py-2 pr-2">Operacion</th>
                                                                                <th className="py-2 pr-2 text-right">Cantidad</th>
                                                                                <th className="py-2 pr-2 text-right">Valor</th>
                                                                                <th className="py-2 pr-2">Estado</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {empProductions.map((p) => (
                                                                                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                                                                                    <td className="py-2 pr-2">{formatDate(p.date)}</td>
                                                                                    <td className="py-2 pr-2">
                                                                                        {p.reference ? `${p.reference.code} · ${p.reference.name}` : '—'}
                                                                                    </td>
                                                                                    <td className="py-2 pr-2">{p.operation?.name ?? '—'}</td>
                                                                                    <td className="py-2 pr-2 text-right tabular-nums">{p.quantity}</td>
                                                                                    <td className="py-2 pr-2 text-right tabular-nums">
                                                                                        {formatCurrency(p.total_value)}
                                                                                    </td>
                                                                                    <td className="py-2 pr-2 capitalize">{p.status}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                El calculo de nomina incluye producciones confirmadas y pendientes de confirmar.
                                                            </p>
                                                            {adjustmentsPanel(row)}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                        {employeeCount > 0 && (
                            <TableFoot>
                                <tr>
                                    <td className="px-4 py-3 text-right text-xs uppercase text-slate-500" />
                                    <td className="px-4 py-3 text-right text-xs uppercase text-slate-500">Totales</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(totalProduction)}</td>
                                    {showDailyColumn ? (
                                        <td className="px-4 py-3 text-right">{formatCurrency(totalDaily)}</td>
                                    ) : null}
                                    <td className="px-4 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                                        {formatCurrency(totalAdjustments)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(totalGross)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(totalDeductions)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(totalAdvances)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(payroll.total_amount)}
                                    </td>
                                    <td />
                                </tr>
                            </TableFoot>
                        )}
                    </Table>
                </Card>
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

            <Modal
                open={!!adjModal}
                onClose={() => !adjSaving && setAdjModal(null)}
                title={adjModal?.adjustment ? 'Editar ajuste manual' : 'Agregar concepto a la nomina'}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => !adjSaving && setAdjModal(null)} disabled={adjSaving}>
                            Cancelar
                        </Button>
                        <Button loading={adjSaving} onClick={() => submitAdjustment()}>
                            Guardar
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 px-1 py-2">
                    {adjModal?.adjustment ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Concepto:{' '}
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                {adjModal.adjustment.payroll_concept?.name ?? `#${adjModal.adjustment.payroll_concept_id}`}
                            </span>
                        </p>
                    ) : (
                        <Select
                            label="Concepto"
                            placeholder="Seleccionar concepto"
                            options={conceptSelectOptions}
                            value={adjConceptId}
                            onChange={(e) => setAdjConceptId(e.target.value)}
                            required
                        />
                    )}
                    <Input
                        label="Monto"
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                        required
                    />
                    <Textarea
                        label="Nota (opcional)"
                        value={adjNotes}
                        onChange={(e) => setAdjNotes(e.target.value)}
                        rows={2}
                    />
                </div>
            </Modal> 

            <ConfirmDialog
                open={!!confirmDeleteAdj}
                onClose={() => setConfirmDeleteAdj(null)}
                onConfirm={deleteAdjustment}
                title="Eliminar ajuste"
                message="¿Eliminar esta linea de ajuste? Se recalcularan deducciones y totales de la nomina."
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
