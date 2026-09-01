import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Printer, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { AdvanceStatePill } from '@/Components/Advances/AdvanceStatePill';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { advanceState, appliedAmount, coveredPercent } from '@/lib/advances';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import type { Advance, Employee } from '@/types';
import '../../../css/module-ui.css';

interface Application {
    payroll_id: number;
    payroll_name: string;
    period_start: string | null;
    period_end: string | null;
    status: string;
    paid_at: string | null;
    applied_amount: number;
    balance_after: number;
}

interface OtherAdvance {
    id: number;
    date: string;
    amount: string | number;
    remaining_amount: string | number;
    reason: string;
}

interface Props {
    advance: Advance & { employee?: Employee; creator?: { id: number; name: string; last_name: string | null } | null };
    applications: Application[];
    employee_other: OtherAdvance[];
    employee_pending_total: number;
    can_delete: boolean;
}

const PAYROLL_STATUS_LABEL: Record<string, string> = {
    borrador: 'Borrador',
    calculado: 'Calculada',
    aprobado: 'Aprobada',
    pagado: 'Pagada',
};

export default function AdvanceShow({
    advance,
    applications,
    employee_other: otherAdvances,
    employee_pending_total: employeePendingTotal,
    can_delete: canDelete,
}: Props) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const amount = Number(advance.amount);
    const remaining = Math.max(0, Number(advance.remaining_amount));
    const applied = appliedAmount(advance);
    const covered = coveredPercent(advance);
    const closed = advanceState(advance) === 'descontado';

    const employeeName = `${advance.employee?.first_name ?? ''} ${advance.employee?.last_name ?? ''}`.trim() || 'Empleado';

    /** Días desde la entrega; el «hace N días» que se pregunta al revisar caja. */
    const daysAgo = (() => {
        const iso = String(advance.date).slice(0, 10);
        const [y, m, d] = iso.split('-').map(Number);
        if (!y || !m || !d) return null;

        const diff = Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000);

        return diff >= 0 ? diff : null;
    })();

    const metricCards = [
        { label: 'Monto entregado', value: formatCurrency(amount), meta: formatDate(advance.date), accent: false },
        { label: 'Ya descontado', value: formatCurrency(applied), meta: `${covered}% del anticipo`, accent: false },
        {
            label: 'Saldo por descontar',
            value: closed ? '—' : formatCurrency(remaining),
            meta: closed ? 'Cubierto por completo' : 'Sale en la próxima nómina',
            accent: !closed,
        },
        {
            label: 'Entregado hace',
            value: daysAgo !== null ? `${formatNumber(daysAgo)} ${daysAgo === 1 ? 'día' : 'días'}` : '—',
            meta: formatDate(advance.date),
            accent: false,
        },
    ];

    return (
        <AppLayout title={`Anticipo de ${employeeName}`}>
            <Head title={`Anticipo · ${employeeName}`} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-10 pt-5 sm:px-[34px] sm:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link href={route('advances.index')} className="emp-kicker inline-flex items-center gap-1.5 hover:underline">
                            <ArrowLeft size={13} />
                            Anticipos
                        </Link>
                        <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Anticipo del {formatDate(advance.date)}
                        </h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {advance.employee ? (
                                <Link
                                    href={route('employees.show', advance.employee.id)}
                                    className="text-[13px] capitalize underline underline-offset-2"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                >
                                    {employeeName}
                                </Link>
                            ) : (
                                <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                    {employeeName}
                                </span>
                            )}
                            <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                {advance.employee?.document_number}
                            </span>
                            <AdvanceStatePill advance={advance} />
                            {advance.reason ? <span className="emp-pill max-w-[240px] truncate">{advance.reason}</span> : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Can permission="advances.show.receipt">
                            <button
                                type="button"
                                onClick={() => window.open(route('advances.receipt', advance.id), '_blank')}
                                className="emp-btn emp-btn-sm"
                            >
                                <Printer size={15} />
                                Comprobante
                            </button>
                        </Can>
                        {canDelete ? (
                            <Can permission="advances.index.delete">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    className="emp-btn emp-btn-sm"
                                    style={{ borderColor: 'var(--emp-danger)', color: 'var(--emp-danger)' }}
                                >
                                    <Trash size={15} />
                                    Eliminar
                                </button>
                            </Can>
                        ) : null}
                    </div>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
                    {metricCards.map((card) => (
                        <div key={card.label} className="emp-card min-w-[176px] shrink-0 p-[17px] sm:min-w-0">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 text-[27px] leading-none tabular-nums"
                                style={{ color: card.accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {card.value}
                            </p>
                            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {card.meta}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ------------------------------------------------- contenido */}
                <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    <div className="w-full min-w-0 flex-1">
                        <section>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                                    Cómo se ha descontado
                                </h2>
                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                    {covered}% cubierto
                                </span>
                            </div>
                            <EmployeeFadingRule />

                            <div
                                aria-hidden="true"
                                className="mt-3 h-[6px] w-full overflow-hidden rounded-full"
                                style={{ backgroundColor: 'var(--emp-row)' }}
                            >
                                <span
                                    className="block h-full rounded-full"
                                    style={{
                                        width: `${covered}%`,
                                        backgroundColor: closed ? 'var(--emp-faint)' : 'var(--emp-accent)',
                                    }}
                                />
                            </div>

                            {applications.length === 0 ? (
                                <div className="emp-card mt-3 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                    {applied > 0
                                        ? `Ya se descontaron ${formatCurrency(applied)}, pero el sistema no guarda en qué nómina cayó cada parte.`
                                        : 'Todavía no se ha descontado nada.'}
                                </div>
                            ) : (
                                <>
                                    {/* Escritorio: tabla. */}
                                    <div className="mt-3 hidden lg:block">
                                        <div
                                            className="grid gap-2.5 px-2 pb-2 text-[11px] uppercase tracking-[0.09em]"
                                            style={{
                                                gridTemplateColumns: '1fr 120px 120px 120px',
                                                color: 'var(--emp-subtle)',
                                                borderBottom: '1px solid var(--emp-border)',
                                            }}
                                        >
                                            <span>Nómina</span>
                                            <span>Estado</span>
                                            <span className="text-right">Aplicado</span>
                                            <span className="text-right">Saldo después</span>
                                        </div>
                                        {applications.map((application) => (
                                            <div
                                                key={application.payroll_id}
                                                className="emp-row-sep emp-hover-row grid items-center gap-2.5 px-2 py-2.5"
                                                style={{ gridTemplateColumns: '1fr 120px 120px 120px' }}
                                            >
                                                <Link
                                                    href={route('payrolls.show', application.payroll_id)}
                                                    className="truncate text-[13px] hover:underline"
                                                    style={{ color: 'var(--emp-text)' }}
                                                >
                                                    {application.payroll_name}
                                                </Link>
                                                <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                                    {PAYROLL_STATUS_LABEL[application.status] ?? application.status}
                                                    {application.paid_at ? ` · ${formatDate(application.paid_at)}` : ''}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                    {formatCurrency(application.applied_amount)}
                                                </span>
                                                <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                                    {formatCurrency(application.balance_after)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Movil: tarjetas. */}
                                    <div className="mt-3 flex flex-col gap-2 lg:hidden">
                                        {applications.map((application) => (
                                            <article key={application.payroll_id} className="emp-card p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                                            {application.payroll_name}
                                                        </span>
                                                        <span className="block text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                                            {PAYROLL_STATUS_LABEL[application.status] ?? application.status}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-right">
                                                        <span className="block text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                            {formatCurrency(application.applied_amount)}
                                                        </span>
                                                        <span className="block text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                                            queda {formatCurrency(application.balance_after)}
                                                        </span>
                                                    </span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </>
                            )}

                            {!closed ? (
                                <p className="emp-note mt-3">
                                    Los {formatCurrency(remaining)} restantes se descuentan solos en la próxima nómina. Puedes
                                    bajar el monto a aplicar al cerrar el periodo si el neto queda muy corto.
                                </p>
                            ) : null}
                        </section>
                    </div>

                    {/* ------------------------------------------------ panel */}
                    <aside className="flex w-full flex-col gap-4 lg:w-[292px] lg:shrink-0">
                        <EmployeeAsideCard title="Registro">
                            <dl className="mt-2 flex flex-col gap-2 text-[12px]">
                                <div>
                                    <dt style={{ color: 'var(--emp-muted)' }}>Motivo</dt>
                                    <dd className="mt-0.5 whitespace-pre-line" style={{ color: 'var(--emp-text)' }}>
                                        {advance.reason || '—'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Registrado</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>{formatDateTime(advance.created_at)}</dd>
                                </div>
                                {advance.creator ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <dt style={{ color: 'var(--emp-muted)' }}>Por</dt>
                                        <dd className="capitalize" style={{ color: 'var(--emp-text)' }}>
                                            {advance.creator.name} {advance.creator.last_name}
                                        </dd>
                                    </div>
                                ) : null}
                                <div className="flex items-start justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Se puede eliminar</dt>
                                    <dd className="text-right" style={{ color: canDelete ? 'var(--emp-ok)' : 'var(--emp-muted)' }}>
                                        {canDelete ? 'Sí' : 'No: ya tiene descuentos aplicados'}
                                    </dd>
                                </div>
                            </dl>
                        </EmployeeAsideCard>

                        <EmployeeAsideCard title={`Otros anticipos de ${advance.employee?.first_name ?? 'este empleado'}`}>
                            {otherAdvances.length === 0 ? (
                                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                    No tiene otros anticipos registrados.
                                </p>
                            ) : (
                                <ul className="mt-2 flex flex-col gap-1.5">
                                    {otherAdvances.map((other) => (
                                        <li key={other.id}>
                                            <Link
                                                href={route('advances.show', other.id)}
                                                className="flex items-center justify-between gap-3 text-[12px] hover:underline"
                                            >
                                                <span className="truncate" style={{ color: 'var(--emp-muted)' }}>
                                                    {formatDate(other.date)}
                                                </span>
                                                <span className="shrink-0 tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                    {formatCurrency(other.amount)}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div aria-hidden="true" className="my-2.5 h-px" style={{ backgroundColor: 'var(--emp-border)' }} />

                            <div className="flex items-center justify-between gap-3 text-[12px]">
                                <span style={{ color: 'var(--emp-muted)' }}>Saldo total del empleado</span>
                                <span className="tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                                    {formatCurrency(employeePendingTotal)}
                                </span>
                            </div>
                        </EmployeeAsideCard>
                    </aside>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    router.delete(route('advances.destroy', advance.id), { onFinish: () => setConfirmDelete(false) });
                }}
                title="Eliminar anticipo"
                message={`Se elimina el anticipo de ${employeeName} por ${formatCurrency(
                    amount,
                )}. Solo es posible porque todavía no tiene descuentos aplicados.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
