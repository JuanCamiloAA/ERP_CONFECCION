/**
 * Reglas del modulo de gastos que la pantalla necesita en varios sitios.
 */

export type ReceiptKind = 'pdf' | 'image' | 'missing';

export interface ExpenseRowLike {
    id: number;
    amount: number;
    description: string;
    expense_date: string;
    created_at: string | null;
    notes?: string | null;
    needs_detail?: boolean;
    receipt_url: string | null;
    receipt_mime: string | null;
    category: { id: number; name: string } | null;
    creator: { id: number; full_name: string } | null;
    company?: { id: number; name: string } | null;
}

/**
 * Que clase de comprobante tiene el gasto.
 *
 * «Falta» es un estado de primera clase, no la ausencia de dato: el comprobante es
 * obligatorio al registrar, asi que un gasto viejo sin el es justo lo que hay que ver.
 */
export function receiptKind(expense: Pick<ExpenseRowLike, 'receipt_url' | 'receipt_mime'>): ReceiptKind {
    if (!expense.receipt_url) {
        return 'missing';
    }

    return String(expense.receipt_mime ?? '').includes('pdf') ? 'pdf' : 'image';
}

export const RECEIPT_LABEL: Record<ReceiptKind, string> = {
    pdf: 'PDF',
    image: 'Imagen',
    missing: 'Falta',
};

const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function monthName(index: number): string {
    return MONTHS[index] ?? '';
}

export interface ExpenseMonthBucket<T> {
    key: string;
    label: string;
    rows: T[];
    total: number;
}

/**
 * Agrupa por mes conservando el orden en que llegan.
 *
 * El servidor ya ordena por fecha descendente; reordenar aqui romperia la
 * correspondencia con la paginacion.
 */
export function groupExpensesByMonth<T extends { expense_date: string; amount: number }>(
    rows: T[],
): ExpenseMonthBucket<T>[] {
    const buckets = new Map<string, ExpenseMonthBucket<T>>();

    rows.forEach((row) => {
        const iso = String(row.expense_date).slice(0, 10);
        const [year, month] = iso.split('-');
        const key = `${year}-${month}`;
        const label = `${MONTHS[Number(month) - 1] ?? ''} ${year}`;

        const bucket = buckets.get(key) ?? {
            key,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            rows: [],
            total: 0,
        };

        bucket.rows.push(row);
        bucket.total += Number(row.amount ?? 0);
        buckets.set(key, bucket);
    });

    return [...buckets.values()];
}

export type ExpensePeriod = 'mes' | 'trimestre' | 'anio' | 'todos';

/**
 * Rango del periodo, en la misma aritmetica que usa el servidor.
 *
 * Solo se usa para rotular («del 1 al 31 de agosto»); el filtro real lo aplica el
 * servidor, que es quien manda sobre lo que se lista.
 */
export function periodRange(period: ExpensePeriod, today = new Date()): { from: string; to: string } | null {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const year = today.getFullYear();
    const month = today.getMonth();

    if (period === 'mes') {
        return { from: iso(new Date(Date.UTC(year, month, 1))), to: iso(new Date(Date.UTC(year, month + 1, 0))) };
    }

    if (period === 'trimestre') {
        return { from: iso(new Date(Date.UTC(year, month - 2, 1))), to: iso(new Date(Date.UTC(year, month + 1, 0))) };
    }

    if (period === 'anio') {
        return { from: iso(new Date(Date.UTC(year, 0, 1))), to: iso(new Date(Date.UTC(year, 11, 31))) };
    }

    return null;
}

/** Variacion porcentual entre dos meses; null cuando no hay base con la que comparar. */
export function variationPercent(current: number, previous: number): number | null {
    if (!previous) {
        return null;
    }

    return Math.round(((current - previous) / previous) * 100);
}
