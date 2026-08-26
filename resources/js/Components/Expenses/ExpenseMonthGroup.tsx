import type { ReactNode } from 'react';
import type { ExpenseMonthBucket } from '@/lib/expenses';
import type { ExpenseRowData } from '@/Components/Expenses/ExpenseRow';
import { formatCurrency } from '@/lib/utils';

export { groupExpensesByMonth } from '@/lib/expenses';

/**
 * Un mes de gastos, con su total.
 *
 * Las filas planas obligaban a sumar de cabeza para saber cuanto se llevaba el mes; la
 * cabecera del grupo lo dice.
 */
export function ExpenseMonthGroup({
    bucket,
    children,
}: {
    bucket: ExpenseMonthBucket<ExpenseRowData>;
    children: ReactNode;
}) {
    return (
        <section>
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5 pb-2">
                <h2 className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                    {bucket.label}
                </h2>
                <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    · {bucket.rows.length} {bucket.rows.length === 1 ? 'gasto' : 'gastos'} · {formatCurrency(bucket.total)}
                </p>
            </header>

            {children}
        </section>
    );
}

export default ExpenseMonthGroup;
