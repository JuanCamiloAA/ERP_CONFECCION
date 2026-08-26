import { formatCurrency, formatNumber } from '@/lib/utils';
import { employeeName, RowMenu, StatusMark } from '@/Components/Productions/ProductionTable';
import type { Production } from '@/types';

interface Props {
    production: Production;
    showCompany?: boolean;
    onConfirm: (production: Production) => void;
    onDelete: (production: Production) => void;
}

/**
 * Registro de produccion en movil.
 *
 * Las acciones salen de la tarjeta y se van al menu: antes cada registro gastaba una
 * franja entera en dos botones de 44px, de modo que en una pantalla cabian tres
 * registros. Lo que se lee de un vistazo —quien, que operacion, cuanto— manda; el resto
 * esta a un toque.
 */
export function ProductionRecordCard({ production, showCompany = false, onConfirm, onDelete }: Props) {
    return (
        <article className="emp-card flex items-start gap-3 rounded-xl p-3">
            <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] capitalize" style={{ color: 'var(--emp-text)' }}>
                    {employeeName(production)}
                </p>
                <p className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {production.operation?.name ?? '—'}
                </p>
                <p className="mt-0.5 truncate text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    {production.reference?.code} · {formatNumber(production.quantity)} und ×{' '}
                    {formatCurrency(production.unit_price)}
                </p>
                {showCompany && production.company?.name ? (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {production.company.name}
                    </p>
                ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[15px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    {formatCurrency(production.total_value)}
                </span>
                <StatusMark status={production.status} />
            </div>

            <RowMenu production={production} onConfirm={onConfirm} onDelete={onDelete} />
        </article>
    );
}

export default ProductionRecordCard;
