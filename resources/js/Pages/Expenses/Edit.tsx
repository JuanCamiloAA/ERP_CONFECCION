import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, Trash } from '@phosphor-icons/react';
import { useMemo, useState, type FormEvent } from 'react';
import { EmployeeFormLayout } from '@/Components/Employees/EmployeeFormLayout';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import {
    ExpenseAuditCard,
    ExpenseChecklistCard,
    ExpenseFormFields,
    ExpenseFormNav,
    type ExpenseCategoryOption,
    type ExpenseFormData,
} from '@/Components/Expenses/ExpenseFormFields';
import { ExpenseImpactCard, type MonthContext } from '@/Components/Expenses/ExpenseImpactCard';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { receiptKind, RECEIPT_LABEL, type ExpenseRowLike } from '@/lib/expenses';
import { formatDate } from '@/lib/utils';
import '../../../css/module-ui.css';

type ExpenseDetail = ExpenseRowLike & {
    receipt_original_name: string | null;
    updated_at: string | null;
    creator: { id: number; full_name: string; email: string } | null;
};

interface Props {
    expense: ExpenseDetail;
    categories: ExpenseCategoryOption[];
    monthContext: MonthContext;
}

export default function ExpenseEdit({ expense, categories, monthContext }: Props) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data, setData, post, processing, errors } = useForm<ExpenseFormData & { _method: string }>({
        category_id: expense.category?.id ?? '',
        amount: String(expense.amount),
        expense_date: String(expense.expense_date).slice(0, 10),
        description: expense.description,
        notes: expense.notes ?? '',
        receipt: null,
        _method: 'put',
    });

    const category = useMemo(
        () => categories.find((c) => String(c.id) === String(data.category_id)) ?? null,
        [categories, data.category_id],
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('expenses.update', expense.id), { forceFormData: true });
    };

    const existingKind = receiptKind(expense);
    // Cuenta como comprobante el que ya esta guardado o el que se acaba de elegir: el
    // original no se pierde hasta que se guarde el reemplazo.
    const hasReceipt = Boolean(data.receipt) || existingKind !== 'missing';

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Gastos · Editar</p>
                    <h1 className="mt-0.5 truncate text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        {expense.description}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="emp-pill">Registrado el {formatDate(expense.created_at)}</span>
                        <span className="emp-pill">Comprobante obligatorio</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('expenses.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </header>
    );

    const aside = (
        <>
            <ExpenseImpactCard
                context={monthContext}
                amount={Number(data.amount) || 0}
                categoryId={data.category_id}
                categoryName={category?.name ?? null}
                expenseDate={data.expense_date}
            />
            <ExpenseChecklistCard
                data={data}
                categoryName={category?.name ?? null}
                hasReceipt={hasReceipt}
                receiptLabel={data.receipt?.name ?? expense.receipt_original_name ?? RECEIPT_LABEL[existingKind]}
            />
            <ExpenseAuditCard
                creator={expense.creator?.full_name ?? null}
                createdAt={expense.created_at}
                updatedAt={expense.updated_at}
                companyName={expense.company?.name ?? null}
            />
        </>
    );

    const mobileBar = (
        <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
                <Link href={route('expenses.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Guardar cambios'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title={`Editar gasto #${expense.id}`}>
            <Head title="Editar gasto" />

            <form onSubmit={submit}>
                <EmployeeFormLayout
                    header={header}
                    nav={<ExpenseFormNav data={data} hasReceipt={hasReceipt} />}
                    aside={aside}
                    mobileBar={mobileBar}
                >
                    <ExpenseFormFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        categories={categories}
                        existingReceipt={{
                            url: expense.receipt_url,
                            mime: expense.receipt_mime,
                            name: expense.receipt_original_name,
                            uploadedAt: expense.created_at,
                        }}
                    />

                    <Can permission="expenses.index.delete">
                        <EmployeeFormSection
                            title="Archivar gasto"
                            summary={<span className="emp-pill emp-pill-warn">Eliminación suave</span>}
                        >
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                El gasto deja de sumar en los reportes de costos, pero no se borra: queda en la auditoría
                                con su comprobante por si hay que consultarlo.
                            </p>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="emp-btn emp-btn-danger mt-2.5"
                            >
                                <Trash size={15} />
                                Archivar gasto
                            </button>
                        </EmployeeFormSection>
                    </Can>
                </EmployeeFormLayout>
            </form>

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
