import { formatCurrency, formatDate } from '@/lib/utils';
import type { BillingCharge, BillingChargeStatus } from '@/types';

interface Props {
    charges: BillingCharge[];
}

const STATUS_LABEL: Record<BillingChargeStatus, string> = {
    pendiente: 'Pendiente',
    pagado: 'Pagado',
    fallido: 'Fallido',
};

/** Solo el fallido rompe la escala de grises: es el único que pide hacer algo. */
const STATUS_COLOR: Record<BillingChargeStatus, string> = {
    pendiente: 'var(--emp-muted)',
    pagado: 'var(--emp-ok)',
    fallido: 'var(--emp-danger)',
};

/**
 * Historial de cobros de la membresía.
 *
 * Vive aparte de `MembershipSection` porque el día que haya paginación se le añade aquí
 * sin tocar la sección, y porque su estado vacío es la mitad de su trabajo: mientras no
 * exista la pasarela, lo normal es que no haya ni una fila.
 */
export function BillingHistoryTable({ charges }: Props) {
    if (charges.length === 0) {
        return (
            <p className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                Todavía no hay cobros registrados. Aquí aparecerán las renovaciones de la membresía cuando se cobren.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr>
                        {['Fecha', 'Concepto', 'Estado'].map((header) => (
                            <th
                                key={header}
                                scope="col"
                                className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.09em]"
                                style={{ color: 'var(--emp-subtle)', borderBottom: '1px solid var(--emp-border)' }}
                            >
                                {header}
                            </th>
                        ))}
                        <th
                            scope="col"
                            className="px-3 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.09em]"
                            style={{ color: 'var(--emp-subtle)', borderBottom: '1px solid var(--emp-border)' }}
                        >
                            Importe
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {charges.map((charge) => (
                        <tr key={charge.id} className="emp-row-sep">
                            <td className="px-3 py-2.5 text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {charge.charged_at ? formatDate(charge.charged_at) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                {charge.concept}
                            </td>
                            <td className="px-3 py-2.5 text-[13px]" style={{ color: STATUS_COLOR[charge.status] }}>
                                {STATUS_LABEL[charge.status] ?? charge.status}
                            </td>
                            <td
                                className="px-3 py-2.5 text-right text-[13px] tabular-nums"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                {formatCurrency(charge.amount, charge.currency)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default BillingHistoryTable;
