import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { monthName, variationPercent } from '@/lib/expenses';
import { formatCurrency } from '@/lib/utils';

export interface MonthContext {
    month_total: number;
    prev_month_total: number;
    by_category: Record<string, number>;
}

interface Props {
    context: MonthContext;
    /** Monto que se esta escribiendo, ya en numero. */
    amount: number;
    categoryId: number | '';
    categoryName: string | null;
    /** Fecha del gasto: si cae fuera del mes en curso, el panel lo dice. */
    expenseDate: string;
}

/**
 * Efecto del gasto sobre el mes, recalculado a cada tecla.
 *
 * La pantalla vieja pedia un monto sin decir contra que: este panel responde «cuanto
 * llevamos» antes de guardar, que es la pregunta que se hace quien registra.
 */
export function ExpenseImpactCard({ context, amount, categoryId, categoryName, expenseDate }: Props) {
    const now = new Date();
    const label = `${monthName(now.getMonth())} ${now.getFullYear()}`;

    const inCurrentMonth = String(expenseDate).slice(0, 7) === now.toISOString().slice(0, 7);
    // Un gasto de un mes cerrado no mueve el total de este mes; el panel no debe fingir
    // que si.
    const applied = inCurrentMonth ? amount : 0;
    const newTotal = context.month_total + applied;

    const variation = variationPercent(newTotal, context.prev_month_total);

    const categoryBase = categoryId === '' ? 0 : Number(context.by_category[String(categoryId)] ?? 0);
    const categoryTotal = categoryBase + applied;
    const categoryShare = newTotal > 0 ? Math.round((categoryTotal / newTotal) * 100) : 0;

    return (
        <EmployeeAsideCard title="Impacto en el mes" subtitle={`${label} · se recalcula al escribir`}>
            <p className="mt-2 text-[24px] leading-none tabular-nums" style={{ color: 'var(--emp-accent-on)' }}>
                {formatCurrency(newTotal)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                {formatCurrency(context.month_total)} ya registrados
                {applied > 0 ? ` + ${formatCurrency(applied)} de este gasto` : ''}
                {!inCurrentMonth && amount > 0 ? ' · este gasto cae en otro mes' : ''}
            </p>

            <div aria-hidden="true" className="my-2.5 h-px" style={{ backgroundColor: 'var(--emp-border)' }} />

            <dl className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>Mes anterior</dt>
                    <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(context.prev_month_total)}
                    </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>Variación</dt>
                    <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {variation === null ? '—' : `${variation > 0 ? '+' : ''}${variation}%`}
                    </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                    <dt style={{ color: 'var(--emp-muted)' }}>{categoryName ?? 'Categoría'}</dt>
                    <dd className="text-right tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {categoryId === '' ? '—' : `${formatCurrency(categoryTotal)} · ${categoryShare}% del mes`}
                    </dd>
                </div>
            </dl>
        </EmployeeAsideCard>
    );
}

export default ExpenseImpactCard;
