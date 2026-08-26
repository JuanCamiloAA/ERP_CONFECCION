import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { AdvanceRowData } from '@/Components/Advances/AdvanceRow';

const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export interface MonthBucket {
    key: string;
    label: string;
    rows: AdvanceRowData[];
    total: number;
    pending: number;
}

/**
 * Agrupa por mes conservando el orden en que llegan.
 *
 * El backend ya ordena por fecha descendente, asi que basta una pasada: reordenar aqui
 * rompería la correspondencia con la paginacion.
 */
export function groupByMonth(rows: AdvanceRowData[]): MonthBucket[] {
    const buckets = new Map<string, MonthBucket>();

    rows.forEach((row) => {
        const iso = String(row.date).slice(0, 10);
        const [year, month] = iso.split('-');
        const key = `${year}-${month}`;
        const label = `${MONTHS[Number(month) - 1] ?? ''} ${year}`;

        const bucket = buckets.get(key) ?? {
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            rows: [],
            total: 0,
            pending: 0,
        };

        bucket.rows.push(row);
        bucket.total += Number(row.amount ?? 0);
        bucket.pending += Math.max(0, Number(row.remaining_amount ?? 0));

        buckets.set(key, bucket);
    });

    return [...buckets.values()];
}

/**
 * Un mes de anticipos: cuanto se entrego y cuanto sigue pendiente.
 */
export function AdvanceMonthGroup({ bucket, children }: { bucket: MonthBucket; children: ReactNode }) {
    return (
        <section>
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5 pb-2">
                <h2 className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                    {bucket.label}
                </h2>
                <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    · {bucket.rows.length} {bucket.rows.length === 1 ? 'anticipo' : 'anticipos'} ·{' '}
                    {formatCurrency(bucket.total)} entregados
                    {bucket.pending > 0 ? ` · ${formatCurrency(bucket.pending)} por descontar` : ''}
                </p>
            </header>

            {children}
        </section>
    );
}

export default AdvanceMonthGroup;
