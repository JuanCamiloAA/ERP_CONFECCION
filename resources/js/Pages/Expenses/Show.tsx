import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowSquareOut, PencilSimple, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { ReceiptChip } from '@/Components/Expenses/ReceiptChip';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { receiptKind, type ExpenseRowLike } from '@/lib/expenses';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import '../../../css/module-ui.css';

type ExpenseDetail = ExpenseRowLike & {
    receipt_original_name: string | null;
    updated_at: string | null;
    creator: { id: number; full_name: string; email: string } | null;
};

export default function ExpenseShow({ expense }: { expense: ExpenseDetail }) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [confirmDelete, setConfirmDelete] = useState(false);

    const kind = receiptKind(expense);

    return (
        <AppLayout title={`Gasto #${expense.id}`}>
            <Head title={`Gasto #${expense.id}`} />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-10 pt-5 sm:px-[34px] sm:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link href={route('expenses.index')} className="emp-kicker inline-flex items-center gap-1.5 hover:underline">
                            <ArrowLeft size={13} />
                            Gastos
                        </Link>
                        <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatCurrency(expense.amount)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="emp-pill">{expense.category?.name ?? 'Sin categoría'}</span>
                            <span className="emp-pill">{formatDate(expense.expense_date)}</span>
                            <ReceiptChip expense={expense} />
                            {expense.needs_detail ? <span className="emp-pill emp-pill-accent">Por completar</span> : null}
                        </div>
                    </div>

                    {!isConsolidatedView ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Can permission="expenses.index.edit">
                                <Link href={route('expenses.edit', expense.id)} className="emp-btn emp-btn-sm emp-btn-primary">
                                    <PencilSimple size={15} />
                                    Editar
                                </Link>
                            </Can>
                            <Can permission="expenses.index.delete">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    className="emp-btn emp-btn-sm"
                                    style={{ borderColor: 'var(--emp-danger)', color: 'var(--emp-danger)' }}
                                >
                                    <Trash size={15} />
                                    Archivar
                                </button>
                            </Can>
                        </div>
                    ) : null}
                </div>

                {/* ------------------------------------------------- contenido */}
                <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    <div className="w-full min-w-0 flex-1">
                        <section>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                                    Comprobante
                                </h2>
                                {expense.receipt_original_name ? (
                                    <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {expense.receipt_original_name}
                                    </span>
                                ) : null}
                                {expense.receipt_url ? (
                                    <a
                                        href={expense.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto inline-flex items-center gap-1 text-[12px] underline underline-offset-2"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Abrir en pestaña nueva
                                        <ArrowSquareOut size={13} />
                                    </a>
                                ) : null}
                            </div>
                            <EmployeeFadingRule />

                            <div className="mt-3">
                                {kind === 'missing' ? (
                                    <p className="emp-note">
                                        Este gasto no tiene comprobante. Desde que el comprobante es obligatorio solo
                                        quedan así los registros anteriores: adjúntalo desde «Editar» para cerrarlo.
                                    </p>
                                ) : kind === 'pdf' ? (
                                    <iframe
                                        src={expense.receipt_url ?? ''}
                                        title="Comprobante del gasto"
                                        className="w-full rounded-[12px]"
                                        style={{ height: '520px', border: '1px solid var(--emp-border)' }}
                                    />
                                ) : (
                                    <div
                                        className="overflow-hidden rounded-[12px]"
                                        style={{ border: '1px solid var(--emp-border)' }}
                                    >
                                        <ZoomableImage
                                            src={expense.receipt_url ?? ''}
                                            alt="Comprobante"
                                            title="Comprobante del gasto"
                                            className="max-h-[520px] w-full object-contain"
                                        />
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* ------------------------------------------------ panel */}
                    <aside className="flex w-full flex-col gap-4 lg:w-[292px] lg:shrink-0">
                        <EmployeeAsideCard title="Detalle">
                            <dl className="mt-2 flex flex-col gap-2 text-[12px]">
                                <div>
                                    <dt style={{ color: 'var(--emp-muted)' }}>Descripción</dt>
                                    <dd className="mt-0.5 whitespace-pre-line" style={{ color: 'var(--emp-text)' }}>
                                        {expense.description}
                                    </dd>
                                </div>
                                {expense.notes ? (
                                    <div>
                                        <dt style={{ color: 'var(--emp-muted)' }}>Notas</dt>
                                        <dd className="mt-0.5 whitespace-pre-line" style={{ color: 'var(--emp-text)' }}>
                                            {expense.notes}
                                        </dd>
                                    </div>
                                ) : null}
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Fecha del gasto</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>{formatDate(expense.expense_date)}</dd>
                                </div>
                            </dl>
                        </EmployeeAsideCard>

                        <EmployeeAsideCard title="Auditoría">
                            <dl className="mt-2 flex flex-col gap-2 text-[12px]">
                                <div className="flex items-start justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Registró</dt>
                                    <dd className="text-right" style={{ color: 'var(--emp-text)' }}>
                                        {expense.creator?.full_name ?? '—'}
                                        {expense.creator?.email ? (
                                            <span className="block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {expense.creator.email}
                                            </span>
                                        ) : null}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Registrado el</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>
                                        {expense.created_at ? formatDateTime(expense.created_at) : '—'}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt style={{ color: 'var(--emp-muted)' }}>Última edición</dt>
                                    <dd style={{ color: 'var(--emp-text)' }}>
                                        {expense.updated_at ? formatDateTime(expense.updated_at) : '—'}
                                    </dd>
                                </div>
                                {expense.company ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <dt style={{ color: 'var(--emp-muted)' }}>Empresa</dt>
                                        <dd style={{ color: 'var(--emp-text)' }}>{expense.company.name}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </EmployeeAsideCard>
                    </aside>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={() => {
                    router.delete(route('expenses.destroy', expense.id), {
                        onFinish: () => setConfirmDelete(false),
                    });
                }}
                title="Archivar gasto"
                message={`El gasto «${expense.description}» se archiva (eliminación suave): deja de sumar en los reportes pero queda en la auditoría con su comprobante.`}
                confirmText="Archivar"
                variant="danger"
            />
        </AppLayout>
    );
}
