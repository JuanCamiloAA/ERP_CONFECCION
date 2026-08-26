import { Link } from '@inertiajs/react';
import { ExpenseActionsMenu, type ExpenseRowData } from '@/Components/Expenses/ExpenseRow';
import { ReceiptChip } from '@/Components/Expenses/ReceiptChip';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Props {
    expense: ExpenseRowData;
    onDelete: (expense: ExpenseRowData) => void;
    showCompany?: boolean;
    readOnly?: boolean;
}

/**
 * Un gasto en movil. Sustituye a la fila de ocho columnas, que por debajo de 1024px
 * quedaba ilegible.
 */
export function ExpenseCard({ expense, onDelete, showCompany = false, readOnly = false }: Props) {
    return (
        <article className="emp-card p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {formatDate(expense.expense_date)}
                        {showCompany && expense.company ? ` · ${expense.company.name}` : ''}
                    </p>

                    <Link
                        href={route('expenses.show', expense.id)}
                        className="mt-0.5 block truncate text-[14px]"
                        style={{ color: expense.needs_detail ? 'var(--emp-subtle)' : 'var(--emp-text)' }}
                    >
                        {expense.description}
                    </Link>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="emp-pill">{expense.category?.name ?? 'Sin categoría'}</span>
                        {expense.needs_detail ? <span className="emp-pill emp-pill-accent">Completar</span> : null}
                    </div>
                </div>

                <div className="flex shrink-0 items-start gap-1">
                    <span className="text-right text-[15px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(expense.amount)}
                    </span>
                    <ExpenseActionsMenu expense={expense} onDelete={onDelete} readOnly={readOnly} />
                </div>
            </div>

            <div
                className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2"
                style={{ borderTop: '1px solid var(--emp-row)' }}
            >
                <ReceiptChip expense={expense} />
                <span className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    {expense.creator?.full_name ?? '—'}
                </span>
            </div>
        </article>
    );
}

export default ExpenseCard;
