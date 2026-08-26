import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Check } from '@phosphor-icons/react';
import { useMemo, type FormEvent } from 'react';
import { EmployeeFormLayout } from '@/Components/Employees/EmployeeFormLayout';
import {
    ExpenseChecklistCard,
    ExpenseFormFields,
    ExpenseFormNav,
    type ExpenseCategoryOption,
    type ExpenseFormData,
} from '@/Components/Expenses/ExpenseFormFields';
import { ExpenseImpactCard, type MonthContext } from '@/Components/Expenses/ExpenseImpactCard';
import AppLayout from '@/Layouts/AppLayout';
import { monthName } from '@/lib/expenses';
import '../../../css/module-ui.css';

interface Props {
    categories: ExpenseCategoryOption[];
    monthContext: MonthContext;
}

export default function ExpenseCreate({ categories, monthContext }: Props) {
    const { data, setData, post, processing, errors } = useForm<ExpenseFormData>({
        category_id: categories[0]?.id ?? '',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        description: '',
        notes: '',
        receipt: null,
    });

    const category = useMemo(
        () => categories.find((c) => String(c.id) === String(data.category_id)) ?? null,
        [categories, data.category_id],
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('expenses.store'), { forceFormData: true });
    };

    const now = new Date();
    const disabled = processing || categories.length === 0;

    const header = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
            style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
        >
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="emp-kicker">Gastos · Nuevo</p>
                    <h1 className="mt-0.5 text-[20px]" style={{ color: 'var(--emp-text)' }}>
                        Registrar gasto
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="emp-pill">
                            Suma al gasto de {monthName(now.getMonth())} {now.getFullYear()}
                        </span>
                        <span className="emp-pill">Comprobante obligatorio</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Link href={route('expenses.index')} className="emp-btn emp-btn-ghost max-sm:hidden">
                        <ArrowLeft size={15} />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={disabled} className="emp-btn emp-btn-primary">
                        <Check size={15} />
                        {processing ? 'Guardando…' : 'Registrar gasto'}
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
                hasReceipt={Boolean(data.receipt)}
                receiptLabel={data.receipt?.name ?? ''}
            />
        </>
    );

    const mobileBar = (
        <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
                <Link href={route('expenses.index')} className="emp-btn flex-1">
                    Cancelar
                </Link>
                <button type="submit" disabled={disabled} className="emp-btn emp-btn-primary flex-[2]">
                    {processing ? 'Guardando…' : 'Registrar gasto'}
                </button>
            </div>
        </div>
    );

    return (
        <AppLayout title="Registrar gasto">
            <Head title="Registrar gasto" />

            <form onSubmit={submit}>
                <EmployeeFormLayout
                    header={header}
                    nav={<ExpenseFormNav data={data} hasReceipt={Boolean(data.receipt)} />}
                    aside={aside}
                    mobileBar={mobileBar}
                >
                    <ExpenseFormFields data={data} setData={setData} errors={errors} categories={categories} />
                </EmployeeFormLayout>
            </form>
        </AppLayout>
    );
}
