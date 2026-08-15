import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CalculatorIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
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
import { Checkbox } from '@/Components/UI/Checkbox';
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
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Payroll, PayrollConcept, PayrollEmployee, PayrollEmployeeAdjustment, Production, WorkDaySession, PaginatedResponse } from '@/types';

interface PayrollEmployeeTotals {
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
        Number(row.legal_hourly_subtotal ?? 0) +
        Number(row.adjustments_subtotal ?? 0)
    );
}

function editKey(employeeId: number, sessionId: number): string {
    return `${employeeId}:${sessionId}`;
}

function absenceKey(employeeId: number, workDate: string): string {
    return `${employeeId}:${workDate}`;
}

interface AbsenceEditState {
    discount: boolean;
    note: string;
}

function buildAbsenceConfirmations(
    edits: Record<string, AbsenceEditState>,
    rows: PayrollEmployee[],
): { employee_id: number; dates: { date: string; discount: boolean; note: string | null }[] }[] {
    const byEmp: Record<number, { date: string; discount: boolean; note: string | null }[]> = {};

    rows.forEach((row) => {
        const detail = row.absence_discount_detail ?? [];
        if (!row.employee_id || detail.length === 0) return;

        detail.forEach((item) => {
            const k = absenceKey(row.employee_id, item.work_date);
            const state = edits[k] ?? { discount: item.confirmed, note: item.note ?? '' };
            byEmp[row.employee_id] = byEmp[row.employee_id] ?? [];
            byEmp[row.employee_id].push({
                date: item.work_date,
                discount: state.discount,
                note: state.note.trim() || null,
            });
        });
    });

    return Object.entries(byEmp).map(([employee_id, dates]) => ({
        employee_id: Number(employee_id),
        dates,
    }));
}

function advanceKey(employeeId: number, advanceId: number): string {
    return `${employeeId}:${advanceId}`;
}

interface AdvanceEditState {
    applied_amount: string;
}

/** Solo se incluyen los anticipos que el admin edito; los demas se descuentan por el saldo completo (default del backend). */
function buildAdvanceAdjustments(
    edits: Record<string, AdvanceEditState>,
    rows: PayrollEmployee[],
): { employee_id: number; advances: { advance_id: number; applied_amount: number }[] }[] {
    const byEmp: Record<number, { advance_id: number; applied_amount: number }[]> = {};

    rows.forEach((row) => {
        const advances = row.advances ?? [];
        if (!row.employee_id || advances.length === 0) return;

        advances.forEach((adv) => {
            const k = advanceKey(row.employee_id, adv.id);
            const state = edits[k];
            if (!state) return;

            const raw = state.applied_amount.trim().replace(',', '.');
            if (raw === '') return;
            const amount = Number(raw);
            if (Number.isNaN(amount) || amount <= 0) return;

            byEmp[row.employee_id] = byEmp[row.employee_id] ?? [];
            byEmp[row.employee_id].push({ advance_id: adv.id, applied_amount: amount });
        });
    });

    return Object.entries(byEmp).map(([employee_id, advances]) => ({
        employee_id: Number(employee_id),
        advances,
    }));
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
    const [absenceEdits, setAbsenceEdits] = useState<Record<string, AbsenceEditState>>({});
    const [advanceEdits, setAdvanceEdits] = useState<Record<string, AdvanceEditState>>({});
    /** Filtro por nombre solo en cliente (movil): la paginacion sigue siendo del servidor. */
    const [employeeSearch, setEmployeeSearch] = useState('');
    /** Empleados con el editor de jornadas desplegado en movil. */
    const [sessionsOpen, setSessionsOpen] = useState<Set<number>>(new Set());

    const rows = payrollEmployees.data;
    // Filtro en cliente solo para la vista movil; no altera la paginacion del servidor.
    const visibleRows = employeeSearch.trim()
        ? rows.filter((r) =>
              `${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''} ${r.employee?.document_number ?? ''}`
                  .toLowerCase()
                  .includes(employeeSearch.trim().toLowerCase()),
          )
        : rows;
    const employeeCount = payrollEmployeeTotals.employee_count;
    const canAdjustBeforeCalc = payroll.status === 'calculado' && perms.can('payrolls.show.edit_time');
    const canManageConceptAdjustments =
        payroll.status === 'calculado' && perms.can('payrolls.show.manage_adjustments');

    const totalProduction = payrollEmployeeTotals.total_production;
    const totalDaily = payrollEmployeeTotals.total_daily;
    const totalLegalHourly = payrollEmployeeTotals.total_legal_hourly;
    const totalAdjustments = payrollEmployeeTotals.total_adjustments;
    const totalGross = payrollEmployeeTotals.total_gross;
    const totalAdvances = payrollEmployeeTotals.total_advances;
    const totalDeductions = payrollEmployeeTotals.total_deductions;

    const showDailyColumn = payrollEmployeeTotals.show_daily_column;
    const showLegalColumn = payrollEmployeeTotals.show_legal_column;
    const detailColSpan = 9 + (showDailyColumn ? 1 : 0) + (showLegalColumn ? 1 : 0);

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
                        <Button size="sm" className="min-h-11 lg:min-h-8" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setAdjModal({ payrollEmployee: row })}>
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
                    <table className="responsive-table w-full min-w-[560px] text-left text-sm">
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
                                    <td className="py-2 pr-2" data-label="Concepto">
                                        {a.payroll_concept?.name ?? `#${a.payroll_concept_id}`}
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums" data-label="Valor">{formatCurrency(a.amount)}</td>
                                    <td className="py-2 pr-2 text-slate-600 dark:text-slate-400" data-label="Nota">{a.notes ?? '—'}</td>
                                    <td className="py-2 pr-2 text-right" data-label="Acciones">
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

    const absenceBlock = (row: PayrollEmployee, isHourlyLegalRow: boolean) => {
        const detail = row.absence_discount_detail ?? [];

        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase text-slate-500">Días sin marcación</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {isHourlyLegalRow
                        ? 'Días hábiles esperados (según horario configurado) sin jornada cerrada. Desmarca y anota un motivo para excluir del descuento antes de recalcular.'
                        : 'Solo informativo: en salario diario el día ya no se paga al no existir sesión; esto no resta nada adicional.'}
                </p>
                {detail.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        No hay días hábiles esperados sin marcar en este periodo.
                    </p>
                ) : (
                    <div className="mt-3 space-y-2">
                        {detail.map((item) => {
                            const k = absenceKey(row.employee_id, item.work_date);
                            const state = absenceEdits[k] ?? { discount: item.confirmed, note: item.note ?? '' };
                            const canEdit = isHourlyLegalRow && canAdjustBeforeCalc;

                            return (
                                <div
                                    key={item.work_date}
                                    className="flex flex-wrap items-center gap-3 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-700"
                                >
                                    {isHourlyLegalRow ? (
                                        // <label> (no <span>) para que toda el area de 44px alterne
                                        // la casilla: el componente Checkbox no envuelve el input.
                                        <label className="-my-1 flex min-h-11 cursor-pointer items-center px-2 lg:my-0 lg:min-h-0 lg:px-0">
                                        <Checkbox
                                            className="h-5 w-5 lg:h-4 lg:w-4"
                                            checked={state.discount}
                                            disabled={!canEdit}
                                            onChange={(e) =>
                                                setAbsenceEdits((prev) => ({
                                                    ...prev,
                                                    [k]: { discount: e.target.checked, note: prev[k]?.note ?? state.note },
                                                }))
                                            }
                                        />
                                        </label>
                                    ) : null}
                                    <span className="w-28 shrink-0 text-sm">{formatDate(item.work_date)}</span>
                                    {isHourlyLegalRow && (
                                        <span className="w-28 shrink-0 text-sm font-medium tabular-nums">
                                            {formatCurrency(item.computed_amount)}
                                        </span>
                                    )}
                                    {canEdit ? (
                                        <Input
                                            containerClassName="!mb-0 flex-1 min-w-[180px]"
                                            className="h-11 lg:h-10"
                                            placeholder="Motivo si se justifica (opcional)"
                                            value={state.note}
                                            onChange={(e) =>
                                                setAbsenceEdits((prev) => ({
                                                    ...prev,
                                                    [k]: { discount: prev[k]?.discount ?? state.discount, note: e.target.value },
                                                }))
                                            }
                                        />
                                    ) : (
                                        <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">{item.note || '—'}</span>
                                    )}
                                </div>
                            );
                        })}
                        {isHourlyLegalRow && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Si el descuento no cambia al recalcular, verifica que &quot;Descontar día hábil sin marcación&quot; esté
                                activo en Parámetros Legales de Nómina para esta empresa.
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const advanceBlock = (row: PayrollEmployee) => {
        const advances = row.advances ?? [];
        if (advances.length === 0) return null;

        const canEditAmount = canManageConceptAdjustments;

        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase text-slate-500">Anticipos a descontar</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Por defecto se descuenta el saldo pendiente completo de cada anticipo. Edita el monto para descontar
                    solo una parte; el resto queda pendiente para una proxima nomina.
                </p>
                <div className="mt-3 space-y-2">
                    {advances.map((adv) => {
                        const k = advanceKey(row.employee_id, adv.id);
                        const remaining = Number(adv.remaining_amount);
                        const state = advanceEdits[k];
                        const currentValue = state?.applied_amount ?? String(adv.applied_amount ?? remaining);

                        return (
                            <div
                                key={adv.id}
                                className="flex flex-wrap items-center gap-3 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-700"
                            >
                                <span className="min-w-40 flex-1 text-sm text-slate-600 dark:text-slate-400">
                                    {adv.reason} <span className="text-xs">({formatDate(adv.date)})</span>
                                </span>
                                <span className="w-32 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                    Saldo: {formatCurrency(remaining)}
                                </span>
                                {canEditAmount ? (
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min={0.01}
                                        containerClassName="!mb-0 w-36"
                                        className="h-11 lg:h-10"
                                        value={currentValue}
                                        onChange={(e) =>
                                            setAdvanceEdits((prev) => ({
                                                ...prev,
                                                [k]: { applied_amount: e.target.value },
                                            }))
                                        }
                                    />
                                ) : (
                                    <span className="w-36 text-sm font-medium tabular-nums">
                                        {formatCurrency(adv.applied_amount ?? remaining)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const toggleRow = (payrollEmployeeId: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(payrollEmployeeId)) next.delete(payrollEmployeeId);
            else next.add(payrollEmployeeId);
            return next;
        });
    };

    const toggleSessions = (payrollEmployeeId: number) => {
        setSessionsOpen((prev) => {
            const next = new Set(prev);
            if (next.has(payrollEmployeeId)) next.delete(payrollEmployeeId);
            else next.add(payrollEmployeeId);
            return next;
        });
    };

    /** Etiqueta corta de modalidad, compartida por la fila movil y el resumen. */
    const modeLabel = (mode?: string): string =>
        mode === 'fixed_daily' ? 'Salario diario' : mode === 'hourly_legal' ? 'Por horas (legal)' : 'Por operaciones';

    /**
     * Editor de jornadas para movil: misma clave (`editKey`) y mismo estado `sessionEdits`
     * que la tabla de escritorio, por lo que `buildAdjustments()` recoge los cambios desde
     * cualquiera de las dos vistas. Solo cambia la presentacion (tarjetas en vez de tabla).
     */
    const mobileSessionsEditor = (row: PayrollEmployee, empSessions: WorkDaySession[]) => {
        if (empSessions.length === 0) {
            return <p className="text-sm text-slate-600 dark:text-slate-400">No hay sesiones registradas.</p>;
        }

        return (
            <div className="space-y-2">
                {empSessions.map((s) => {
                    const k = editKey(row.employee_id, s.id);
                    const canEditRow =
                        canAdjustBeforeCalc && (s.status === 'closed' || s.status === 'adjusted') && !!s.clock_out_at;
                    const edit = sessionEdits[k] ?? {
                        duration_minutes: String(s.duration_minutes ?? ''),
                        reason: '',
                    };

                    return (
                        <div
                            key={s.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
                        >
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {formatDate(s.work_date)}
                                </span>
                                <span className="text-xs capitalize text-slate-500 dark:text-slate-400">
                                    {s.status} · {s.duration_minutes ?? '—'} min
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {s.clock_in_at ? new Date(s.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                {' – '}
                                {s.clock_out_at ? new Date(s.clock_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                            {canEditRow ? (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <Input
                                        containerClassName="!mb-0"
                                        label="Ajuste min."
                                        type="number"
                                        min={0}
                                        className="h-11"
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
                                    <Input
                                        containerClassName="!mb-0"
                                        label="Motivo"
                                        placeholder="Opcional"
                                        className="h-11"
                                        value={edit.reason}
                                        onChange={(e) =>
                                            setSessionEdits((prev) => ({
                                                ...prev,
                                                [k]: {
                                                    duration_minutes:
                                                        prev[k]?.duration_minutes ?? String(s.duration_minutes ?? ''),
                                                    reason: e.target.value,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleAction = (action: 'calculate' | 'approve' | 'pay') => {
        const url = {
            calculate: route('payrolls.calculate', payroll.id),
            approve: route('payrolls.approve', payroll.id),
            pay: route('payrolls.pay', payroll.id),
        }[action];

        if (action === 'calculate') {
            const adjustments = buildAdjustments(sessionEdits, workSessionsByEmployee);
            const absenceConfirmations = buildAbsenceConfirmations(absenceEdits, rows);
            const advanceAdjustments = buildAdvanceAdjustments(advanceEdits, rows);
            const payload: Record<string, unknown> = {};
            if (adjustments.length > 0) payload.employee_adjustments = adjustments;
            if (absenceConfirmations.length > 0) payload.absence_confirmations = absenceConfirmations;
            if (advanceAdjustments.length > 0) payload.advance_adjustments = advanceAdjustments;
            router.post(url, payload as never, { onFinish: () => setConfirmAction(null) });
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
            <div className="space-y-6 pb-28 lg:pb-0">
                <PageHeader
                    title={payroll.name}
                    breadcrumbs={[{ label: 'Nominas', href: route('payrolls.index') }, { label: payroll.name }]}
                    action={
                        <div className="hidden flex-wrap gap-2 lg:flex">
                            <Link href={route('payrolls.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Volver
                                </Button>
                            </Link>
                            <a href={route('payrolls.export', payroll.id)} target="_blank" rel="noreferrer">
                                <Button variant="outline" icon={<PrinterIcon className="h-4 w-4" />}>
                                    Imprimir general
                                </Button>
                            </a>
                            <a
                                href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Button variant="outline" icon={<DocumentTextIcon className="h-4 w-4" />}>
                                    Imprimir detallado
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

                {/* Movil: un solo resumen en vez de siete tarjetas. */}
                <Card className="lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Periodo</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {formatDate(payroll.period_start)} – {formatDate(payroll.period_end)}
                            </p>
                            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{payroll.type}</p>
                        </div>
                        <Badge variant={statusVariant[payroll.status]}>{payroll.status}</Badge>
                    </div>

                    <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-700">
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-600 dark:text-slate-400">Bruto producido</dt>
                            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                {formatCurrency(totalProduction)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-600 dark:text-slate-400">Jornada y recargos</dt>
                            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                {formatCurrency(Number(totalDaily) + Number(totalLegalHourly))}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-600 dark:text-slate-400">Ajustes manuales</dt>
                            <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                                {formatCurrency(totalAdjustments)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-600 dark:text-slate-400">Anticipos</dt>
                            <dd className="font-medium tabular-nums text-rose-600 dark:text-rose-400">
                                – {formatCurrency(totalAdvances)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-600 dark:text-slate-400">Deducciones</dt>
                            <dd className="font-medium tabular-nums text-rose-600 dark:text-rose-400">
                                – {formatCurrency(totalDeductions)}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Neto a pagar
                            </p>
                            <p className="text-[22px] font-bold leading-tight tabular-nums text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(payroll.total_amount)}
                            </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(employeeCount)} empleados</p>
                    </div>
                </Card>

                <div className="hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid lg:grid-cols-4 xl:grid-cols-7">
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
                    {/* Movil: buscador + una fila por empleado; comparte `expanded` con escritorio. */}
                    <div className="px-4 pb-4 lg:hidden">
                        {rows.length > 0 ? (
                            <Input
                                containerClassName="!mb-0"
                                className="h-11"
                                placeholder="Buscar empleado..."
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                            />
                        ) : null}

                        <div className="mt-3 space-y-2">
                            {visibleRows.length === 0 ? (
                                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                    {rows.length === 0
                                        ? 'Aun no hay empleados calculados.'
                                        : 'Ningun empleado coincide con la busqueda.'}
                                </p>
                            ) : (
                                visibleRows.map((row) => {
                                    const dedTotal = ((row.deductions as Array<{ amount: number }>) ?? []).reduce(
                                        (s, d) => s + Number(d.amount ?? 0),
                                        0,
                                    );
                                    const isHourlyLegal = row.employee?.payroll_mode === 'hourly_legal';
                                    const isFixed = row.employee?.payroll_mode === 'fixed_daily';
                                    const isOpen = expanded.has(row.id);
                                    const empSessions = row.employee_id
                                        ? workSessionsByEmployee[String(row.employee_id)] ?? []
                                        : [];
                                    const overtimeAlerts = row.overtime_limit_alerts ?? [];

                                    return (
                                        <div
                                            key={row.id}
                                            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleRow(row.id)}
                                                className="flex w-full items-center gap-3 bg-white p-3 text-left dark:bg-slate-800"
                                                aria-expanded={isOpen}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {row.employee?.first_name} {row.employee?.last_name}
                                                    </span>
                                                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {modeLabel(row.employee?.payroll_mode)}
                                                        {isFixed || isHourlyLegal
                                                            ? ' \u00b7 ' + formatNumber(empSessions.length) + ' jornadas'
                                                            : ''}
                                                    </span>
                                                    {overtimeAlerts.length > 0 ? (
                                                        <Badge variant="warning" className="mt-1">
                                                            <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                                                            Tope excedido
                                                        </Badge>
                                                    ) : null}
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                                                        {formatCurrency(row.net_payment)}
                                                    </span>
                                                    <span className="block text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                                                        bruto {formatCurrency(rowGross(row))}
                                                    </span>
                                                </span>
                                                {isOpen ? (
                                                    <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-400" />
                                                ) : (
                                                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-400" />
                                                )}
                                            </button>

                                            {isOpen ? (
                                                <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                                                    <dl className="space-y-1.5 text-sm">
                                                        <div className="flex justify-between gap-3">
                                                            <dt className="text-slate-600 dark:text-slate-400">Producido</dt>
                                                            <dd className="tabular-nums">{formatCurrency(row.production_total)}</dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt className="text-slate-600 dark:text-slate-400">Jornada · recargos</dt>
                                                            <dd className="tabular-nums">
                                                                {formatCurrency(
                                                                    Number(row.daily_work_subtotal ?? 0) +
                                                                        Number(row.legal_hourly_subtotal ?? 0),
                                                                )}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt className="text-slate-600 dark:text-slate-400">Ajustes manuales</dt>
                                                            <dd className="tabular-nums text-amber-700 dark:text-amber-400">
                                                                {formatCurrency(row.adjustments_subtotal ?? 0)}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt className="text-slate-600 dark:text-slate-400">Anticipos</dt>
                                                            <dd className="tabular-nums text-rose-600 dark:text-rose-400">
                                                                – {formatCurrency(row.advances_discount)}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt className="text-slate-600 dark:text-slate-400">
                                                                Ausencias · deducciones
                                                            </dt>
                                                            <dd className="tabular-nums text-rose-600 dark:text-rose-400">
                                                                – {formatCurrency(Number(row.absence_discount_total ?? 0) + dedTotal)}
                                                            </dd>
                                                        </div>
                                                    </dl>

                                                    <div className="flex flex-wrap gap-2">
                                                        {canManageConceptAdjustments ? (
                                                            <Button
                                                                variant="outline"
                                                                icon={<PlusIcon className="h-4 w-4" />}
                                                                className="min-h-10"
                                                                onClick={() => setAdjModal({ payrollEmployee: row })}
                                                            >
                                                                Ajuste
                                                            </Button>
                                                        ) : null}
                                                        {(isFixed || isHourlyLegal) && empSessions.length > 0 ? (
                                                            <Button
                                                                variant="outline"
                                                                className="min-h-10"
                                                                onClick={() => toggleSessions(row.id)}
                                                            >
                                                                Jornadas
                                                            </Button>
                                                        ) : null}
                                                    </div>

                                                    {sessionsOpen.has(row.id) ? mobileSessionsEditor(row, empSessions) : null}

                                                    {advanceBlock(row)}
                                                    {isFixed || isHourlyLegal ? absenceBlock(row, isHourlyLegal) : null}
                                                    {adjustmentsPanel(row)}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:block">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader className="w-10" />
                                <TableHeader>Empleado</TableHeader>
                                <TableHeader align="right">Producido</TableHeader>
                                {showDailyColumn ? <TableHeader align="right">Jornada</TableHeader> : null}
                                {showLegalColumn ? <TableHeader align="right">Legal (horas)</TableHeader> : null}
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
                                    const isHourlyLegal = row.employee?.payroll_mode === 'hourly_legal';
                                    const isOpen = expanded.has(row.id);
                                    const empSessions = row.employee_id ? workSessionsByEmployee[String(row.employee_id)] ?? [] : [];
                                    const empProductions = row.employee_id ? productionsByEmployee[String(row.employee_id)] ?? [] : [];
                                    const showProductionDetail = !isFixed && !isHourlyLegal;
                                    const showExpandControl = isFixed || isHourlyLegal || showProductionDetail;
                                    const overtimeAlerts = row.overtime_limit_alerts ?? [];

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
                                                            {row.employee.payroll_mode === 'fixed_daily'
                                                                ? 'Salario diario'
                                                                : row.employee.payroll_mode === 'hourly_legal'
                                                                  ? 'Por horas (legal)'
                                                                  : 'Por operaciones'}
                                                        </Badge>
                                                    ) : null}
                                                    {overtimeAlerts.length > 0 && (
                                                        <Badge variant="warning" className="mt-1 ml-1">
                                                            <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                                                            Tope excedido
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">{formatCurrency(row.production_total)}</TableCell>
                                                {showDailyColumn ? (
                                                    <TableCell align="right">{formatCurrency(row.daily_work_subtotal ?? 0)}</TableCell>
                                                ) : null}
                                                {showLegalColumn ? (
                                                    <TableCell align="right">{formatCurrency(row.legal_hourly_subtotal ?? 0)}</TableCell>
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
                                                                        <table className="responsive-table w-full min-w-[640px] text-left text-sm">
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
                                                                                            <td className="py-2 pr-2" data-label="Fecha">{formatDate(s.work_date)}</td>
                                                                                            <td className="py-2 pr-2 capitalize" data-label="Estado">{s.status}</td>
                                                                                            <td className="py-2 pr-2" data-label="Entrada">
                                                                                                {s.clock_in_at
                                                                                                    ? new Date(s.clock_in_at).toLocaleString()
                                                                                                    : '—'}
                                                                                            </td>
                                                                                            <td className="py-2 pr-2" data-label="Salida">
                                                                                                {s.clock_out_at
                                                                                                    ? new Date(s.clock_out_at).toLocaleString()
                                                                                                    : '—'}
                                                                                            </td>
                                                                                            <td className="py-2 pr-2" data-label="Minutos">{s.duration_minutes ?? '—'}</td>
                                                                                            <td className="py-2 pr-2" data-label="Ajuste min.">
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
                                                                                            <td className="py-2 pr-2" data-label="Motivo">
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
                                                                        <table className="responsive-table w-full min-w-[560px] text-left text-sm">
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
                                                                                        <td className="py-2 pr-2" data-label="Fecha">{formatDate(d.work_date)}</td>
                                                                                        <td className="py-2 pr-2" data-label="Minutos">{d.duration_minutes}</td>
                                                                                        <td className="py-2 pr-2" data-label="Efectivos">{d.effective_minutes}</td>
                                                                                        <td className="py-2 pr-2 text-right" data-label="Valor dia">{formatCurrency(d.day_earnings)}</td>
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
                                                                        <table className="responsive-table w-full min-w-[720px] text-left text-sm">
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
                                                                                        <td className="py-2 pr-2" data-label="Fecha">{formatDate(p.date)}</td>
                                                                                        <td className="py-2 pr-2" data-label="Referencia">
                                                                                            {p.reference ? `${p.reference.code} · ${p.reference.name}` : '—'}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2" data-label="Operacion">{p.operation?.name ?? '—'}</td>
                                                                                        <td className="py-2 pr-2 text-right tabular-nums" data-label="Cantidad">{p.quantity}</td>
                                                                                        <td className="py-2 pr-2 text-right tabular-nums" data-label="Valor">
                                                                                            {formatCurrency(p.total_value)}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 capitalize" data-label="Estado">{p.status}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                            {absenceBlock(row, false)}
                                                            {advanceBlock(row)}
                                                            {adjustmentsPanel(row)}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                            {isOpen && isHourlyLegal ? (
                                                <TableRow key={`${row.id}-detail-legal`}>
                                                    <TableCell colSpan={detailColSpan} className="bg-slate-50 px-4 py-4 dark:bg-slate-900/40">
                                                        <div className="space-y-4">
                                                            {overtimeAlerts.length > 0 && (
                                                                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                                                                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                                                                    <div>
                                                                        <p className="font-medium">Horas extra sobre el tope legal:</p>
                                                                        <ul className="mt-1 list-inside list-disc">
                                                                            {overtimeAlerts.map((alert, i) => (
                                                                                <li key={i}>{alert}</li>
                                                                            ))}
                                                                        </ul>
                                                                        <p className="mt-1 text-xs">
                                                                            Las horas extra requieren autorizacion previa del Ministerio del
                                                                            Trabajo; el sistema no verifica ese tramite.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {row.legal_hours_breakdown ? (
                                                                <div>
                                                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                                                        Resumen de liquidacion legal
                                                                    </p>
                                                                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                                        <div>
                                                                            <p className="text-xs text-slate-500">Salario base periodo</p>
                                                                            <p className="font-medium tabular-nums">
                                                                                {formatCurrency(row.legal_hours_breakdown.base_salary_earned)}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-slate-500">Recargo nocturno</p>
                                                                            <p className="font-medium tabular-nums">
                                                                                {formatCurrency(row.legal_hours_breakdown.night_surcharge_amount)}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-slate-500">Recargo dominical/festivo</p>
                                                                            <p className="font-medium tabular-nums">
                                                                                {formatCurrency(row.legal_hours_breakdown.sunday_holiday_surcharge_amount)}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs text-slate-500">Horas extra</p>
                                                                            <p className="font-medium tabular-nums">
                                                                                {formatCurrency(row.legal_hours_breakdown.overtime_amount)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                                        Valor/hora aplicado: {formatCurrency(row.legal_hours_breakdown.hourly_rate_applied)} ·
                                                                        Jornada semanal legal: {String(row.legal_hours_breakdown.legal_parameters_snapshot?.weekly_legal_hours ?? '—')}h ·
                                                                        Divisor mensual: {String(row.legal_hours_breakdown.legal_parameters_snapshot?.monthly_hours_divisor ?? '—')}
                                                                    </p>
                                                                </div>
                                                            ) : null}

                                                            {row.legal_hours_breakdown && row.legal_hours_breakdown.daily_detail.length > 0 ? (
                                                                <div>
                                                                    <p className="text-xs font-semibold uppercase text-slate-500">Detalle por dia</p>
                                                                    <div className="mt-2 overflow-x-auto">
                                                                        <table className="responsive-table w-full min-w-[820px] text-left text-sm">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                                                                                    <th className="py-2 pr-2">Fecha</th>
                                                                                    <th className="py-2 pr-2">Entrada</th>
                                                                                    <th className="py-2 pr-2">Salida</th>
                                                                                    <th className="py-2 pr-2 text-right">Ordinaria diurna</th>
                                                                                    <th className="py-2 pr-2 text-right">Ordinaria nocturna</th>
                                                                                    <th className="py-2 pr-2 text-right">Extra diurna</th>
                                                                                    <th className="py-2 pr-2 text-right">Extra nocturna</th>
                                                                                    <th className="py-2 pr-2 text-center">Dom/Festivo</th>
                                                                                    <th className="py-2 pr-2 text-right">Valor del dia</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {row.legal_hours_breakdown.daily_detail.map((d) => (
                                                                                    <tr key={d.session_id} className="border-b border-slate-100 dark:border-slate-800">
                                                                                        <td className="py-2 pr-2" data-label="Fecha">{formatDate(d.work_date)}</td>
                                                                                        <td className="py-2 pr-2" data-label="Entrada">
                                                                                            {d.clock_in_at ? new Date(d.clock_in_at).toLocaleTimeString() : '—'}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2" data-label="Salida">
                                                                                            {d.clock_out_at ? new Date(d.clock_out_at).toLocaleTimeString() : '—'}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-right" data-label="Ordinaria diurna">
                                                                                            {formatNumber(d.ordinary_day_minutes)} min
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-right" data-label="Ordinaria nocturna">
                                                                                            {formatNumber(d.ordinary_night_minutes)} min
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-right" data-label="Extra diurna">
                                                                                            {formatNumber(d.extra_day_minutes)} min
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-right" data-label="Extra nocturna">
                                                                                            {formatNumber(d.extra_night_minutes)} min
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-center" data-label="Dom/Festivo">
                                                                                            {d.is_sunday_holiday ? <Badge variant="warning">Sí</Badge> : '—'}
                                                                                        </td>
                                                                                        <td className="py-2 pr-2 text-right tabular-nums" data-label="Valor del dia">
                                                                                            {formatCurrency(d.day_amount)}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                                    No hay jornadas cerradas o ajustadas en este periodo.
                                                                </p>
                                                            )}

                                                            {absenceBlock(row, true)}
                                                            {advanceBlock(row)}
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
                                                                    <table className="responsive-table w-full min-w-[720px] text-left text-sm">
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
                                                                                    <td className="py-2 pr-2" data-label="Fecha">{formatDate(p.date)}</td>
                                                                                    <td className="py-2 pr-2" data-label="Referencia">
                                                                                        {p.reference ? `${p.reference.code} · ${p.reference.name}` : '—'}
                                                                                    </td>
                                                                                    <td className="py-2 pr-2" data-label="Operacion">{p.operation?.name ?? '—'}</td>
                                                                                    <td className="py-2 pr-2 text-right tabular-nums" data-label="Cantidad">{p.quantity}</td>
                                                                                    <td className="py-2 pr-2 text-right tabular-nums" data-label="Valor">
                                                                                        {formatCurrency(p.total_value)}
                                                                                    </td>
                                                                                    <td className="py-2 pr-2 capitalize" data-label="Estado">{p.status}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                El calculo de nomina incluye producciones confirmadas y pendientes de confirmar.
                                                            </p>
                                                            {advanceBlock(row)}
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
                                    {showLegalColumn ? (
                                        <td className="px-4 py-3 text-right">{formatCurrency(totalLegalHourly)}</td>
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
                    </div>
                </Card>
            </div>

            {/* Movil: imprimir + la accion del estado, al alcance del pulgar. */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                <a
                    href={route('payrolls.export', payroll.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    aria-label="Imprimir nomina"
                >
                    <PrinterIcon className="h-5 w-5" />
                </a>
                {payroll.status === 'borrador' || payroll.status === 'calculado' ? (
                    <Can permission="payrolls.show.calculate">
                        <Button
                            icon={<CalculatorIcon className="h-5 w-5" />}
                            fullWidth
                            className="min-h-12 text-base"
                            onClick={() => setConfirmAction('calculate')}
                        >
                            Calcular
                        </Button>
                    </Can>
                ) : null}
                {payroll.status === 'calculado' ? (
                    <Can permission="payrolls.show.approve">
                        <Button
                            variant="success"
                            icon={<CheckCircleIcon className="h-5 w-5" />}
                            fullWidth
                            className="min-h-12 text-base"
                            onClick={() => setConfirmAction('approve')}
                        >
                            Aprobar
                        </Button>
                    </Can>
                ) : null}
                {payroll.status === 'aprobado' ? (
                    <Can permission="payrolls.show.pay">
                        <Button
                            variant="success"
                            icon={<BanknotesIcon className="h-5 w-5" />}
                            fullWidth
                            className="min-h-12 text-base"
                            onClick={() => setConfirmAction('pay')}
                        >
                            Marcar pagada
                        </Button>
                    </Can>
                ) : null}
                {payroll.status === 'pagado' ? (
                    <a
                        href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-600 text-sm font-semibold text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                    >
                        <DocumentTextIcon className="h-5 w-5" />
                        Comprobantes
                    </a>
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
