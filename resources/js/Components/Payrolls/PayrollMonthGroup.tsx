import type { ReactNode } from 'react';
import type { PayrollMonthBucket } from '@/lib/payrolls';
import { formatCurrency } from '@/lib/utils';

/**
 * Un mes de nomina: cuantos periodos hay, cuanto suman y cuantos siguen sin pagar.
 *
 * El listado sin agrupar obligaba a leer fecha por fecha para saber si el mes estaba
 * cerrado; la cabecera responde esa pregunta de un vistazo.
 */
export function PayrollMonthGroup<T>({ bucket, children }: { bucket: PayrollMonthBucket<T>; children: ReactNode }) {
    return (
        <section>
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5 pb-2">
                <h2 className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                    {bucket.label}
                </h2>
                <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    · {bucket.rows.length} {bucket.rows.length === 1 ? 'nómina' : 'nóminas'} ·{' '}
                    {formatCurrency(bucket.total)} liquidados
                    {bucket.unpaid > 0
                        ? ` · ${bucket.unpaid} ${bucket.unpaid === 1 ? 'pendiente' : 'pendientes'} de pago`
                        : ''}
                </p>
            </header>

            {children}
        </section>
    );
}

export default PayrollMonthGroup;
