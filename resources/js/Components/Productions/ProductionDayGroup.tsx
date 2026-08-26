import { Check } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Can } from '@/Components/UI/Can';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Production } from '@/types';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "2026-08-21" -> "Viernes 21 de agosto". Se construye la fecha en local, no con Date(iso). */
export function longDayLabel(date: string): string {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return date;

    const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()] ?? '';
    const label = `${weekday} ${d} de ${MONTHS[m - 1] ?? ''}`;

    return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface DayBucket {
    date: string;
    rows: Production[];
    quantity: number;
    value: number;
    employees: number;
    pending: number;
}

/**
 * Agrupa los registros de la pagina por fecha, conservando el orden en que llegan.
 *
 * El backend ya devuelve ordenado por fecha descendente, asi que basta con recorrer una
 * vez: reordenar aqui rompería la correspondencia con la paginacion.
 */
export function groupByDay(rows: Production[]): DayBucket[] {
    const buckets = new Map<string, DayBucket>();

    rows.forEach((row) => {
        const date = String(row.date).slice(0, 10);
        const bucket = buckets.get(date) ?? {
            date,
            rows: [],
            quantity: 0,
            value: 0,
            employees: 0,
            pending: 0,
        };

        bucket.rows.push(row);
        bucket.quantity += Number(row.quantity ?? 0);
        bucket.value += Number(row.total_value ?? 0);
        if (row.status === 'pendiente') bucket.pending += 1;

        buckets.set(date, bucket);
    });

    return [...buckets.values()].map((bucket) => ({
        ...bucket,
        employees: new Set(bucket.rows.map((r) => r.employee_id)).size,
    }));
}

interface Props {
    bucket: DayBucket;
    onConfirmDay: (bucket: DayBucket) => void;
    children: ReactNode;
}

/**
 * Un dia de produccion: cabecera con su subtotal y la accion de cerrarlo.
 *
 * Confirmar el dia es la accion natural del cierre: se revisa la jornada completa y se
 * aprueba de una vez. Registro por registro son treinta confirmaciones.
 */
export function ProductionDayGroup({ bucket, onConfirmDay, children }: Props) {
    return (
        <section>
            <header className="emp-strip flex flex-wrap items-center gap-x-3 gap-y-1 px-[17px] py-2.5">
                <h3 className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {longDayLabel(bucket.date)}
                </h3>
                <p className="min-w-0 flex-1 truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {formatNumber(bucket.rows.length)} {bucket.rows.length === 1 ? 'registro' : 'registros'} ·{' '}
                    {formatNumber(bucket.quantity)} unidades · {formatNumber(bucket.employees)}{' '}
                    {bucket.employees === 1 ? 'empleado' : 'empleados'}
                </p>
                <span className="text-[15px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    {formatCurrency(bucket.value)}
                </span>

                {bucket.pending > 0 ? (
                    <Can permission="productions.index.edit">
                        <button type="button" onClick={() => onConfirmDay(bucket)} className="emp-btn emp-btn-sm emp-btn-primary">
                            <Check size={13} />
                            Confirmar el día
                        </button>
                    </Can>
                ) : (
                    <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        Día confirmado
                    </span>
                )}
            </header>

            {children}
        </section>
    );
}

export default ProductionDayGroup;
