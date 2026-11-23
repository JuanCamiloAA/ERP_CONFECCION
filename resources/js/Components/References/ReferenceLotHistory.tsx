import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { ReferenceLotSummary } from '@/types';

interface Props {
    /** De la vigente a la primera. */
    lots: ReferenceLotSummary[];
    currency: string;
}

const fecha = (iso: string | null) => (iso ? formatDate(iso, 'd MMM yyyy') : '—');

/**
 * Historial de programaciones de una referencia.
 *
 * Cada fila es un pedido de la misma prenda: con que lote y que valor se programo, cuanto
 * se alcanzo a producir y cuanto se pago por ello. Los valores de las cerradas son los que
 * tenian al cerrarse, no los de hoy.
 *
 * En escritorio es una tabla; en movil, una tarjeta por programacion.
 */
export function ReferenceLotHistory({ lots, currency }: Props) {
    const avance = (l: ReferenceLotSummary) =>
        l.lot_total_quantity && l.lot_total_quantity > 0
            ? `${formatNumber(l.operations_completed)} de ${formatNumber(l.operations_total)} op.`
            : '—';

    const periodo = (l: ReferenceLotSummary) => (l.is_current ? `Desde ${fecha(l.started_at)}` : `${fecha(l.started_at)} – ${fecha(l.ended_at)}`);

    const etiqueta = (l: ReferenceLotSummary) => (
        <span className="flex items-center gap-1.5">
            <span style={{ color: 'var(--ref-text)' }}>Programación {l.lot_number}</span>
            {l.is_current ? (
                <span
                    className="rounded-full px-1.5 py-px text-[10px]"
                    style={{ backgroundColor: 'var(--ref-accent-soft)', color: 'var(--ref-accent-on)' }}
                >
                    vigente
                </span>
            ) : null}
        </span>
    );

    return (
        <>
            {/* --- escritorio --- */}
            <div className="hidden overflow-hidden rounded-[10px] sm:block" style={{ border: '1px solid var(--ref-border)' }}>
                <table className="w-full text-[12px]">
                    <thead style={{ backgroundColor: 'var(--ref-surface-head)', color: 'var(--ref-muted)' }}>
                        <tr>
                            <th className="px-3 py-2 text-left font-normal">Programación</th>
                            <th className="px-3 py-2 text-right font-normal">Lote</th>
                            <th className="px-3 py-2 text-right font-normal">Pago u.</th>
                            <th className="px-3 py-2 text-right font-normal">Costo op. u.</th>
                            <th className="px-3 py-2 text-right font-normal">Producidas</th>
                            <th className="px-3 py-2 text-right font-normal">Valor producción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lots.map((l) => (
                            <tr key={l.lot_number} style={{ borderTop: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}>
                                <td className="px-3 py-2.5 align-top">
                                    {etiqueta(l)}
                                    <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                        {periodo(l)}
                                        {l.closed_by ? ` · cerró ${l.closed_by}` : ''}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-right align-top tabular-nums" style={{ color: 'var(--ref-text)' }}>
                                    {l.lot_total_quantity != null ? formatNumber(l.lot_total_quantity) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right align-top tabular-nums" style={{ color: 'var(--ref-text)' }}>
                                    {l.payment_per_unit != null ? formatCurrency(l.payment_per_unit, currency) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right align-top tabular-nums" style={{ color: 'var(--ref-text)' }}>
                                    {formatCurrency(l.operational_cost_per_unit, currency)}
                                </td>
                                <td className="px-3 py-2.5 text-right align-top tabular-nums" style={{ color: 'var(--ref-text)' }}>
                                    {formatNumber(l.produced_max)}
                                    <span className="block text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                        {avance(l)}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-right align-top tabular-nums" style={{ color: 'var(--ref-text)' }}>
                                    {formatCurrency(l.production_value, currency)}
                                    <span className="block text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                        {formatNumber(l.records)} {l.records === 1 ? 'registro' : 'registros'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- movil --- */}
            <ul className="space-y-2 sm:hidden">
                {lots.map((l) => (
                    <li
                        key={l.lot_number}
                        className="rounded-[10px] px-3 py-2.5 text-[12px]"
                        style={{ border: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}
                    >
                        <div className="flex items-baseline justify-between gap-2">
                            {etiqueta(l)}
                            <span className="text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                {periodo(l)}
                            </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                            {[
                                ['Lote', l.lot_total_quantity != null ? `${formatNumber(l.lot_total_quantity)} u.` : '—'],
                                ['Pago u.', l.payment_per_unit != null ? formatCurrency(l.payment_per_unit, currency) : '—'],
                                ['Producidas', `${formatNumber(l.produced_max)} u. · ${avance(l)}`],
                                ['Valor producción', formatCurrency(l.production_value, currency)],
                            ].map(([k, v]) => (
                                <div key={k} className="min-w-0">
                                    <dt style={{ color: 'var(--ref-muted)' }}>{k}</dt>
                                    <dd className="truncate" style={{ color: 'var(--ref-text)' }}>
                                        {v}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </li>
                ))}
            </ul>
        </>
    );
}
