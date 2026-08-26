import { Link } from '@inertiajs/react';
import { AdvanceBalanceCell } from '@/Components/Advances/AdvanceBalanceCell';
import { AdvanceActionsMenu, employeeName, type AdvanceRowData } from '@/Components/Advances/AdvanceRow';
import { AdvanceStatePill } from '@/Components/Advances/AdvanceStatePill';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Props {
    advance: AdvanceRowData;
    onDelete: (advance: AdvanceRowData) => void;
}

/**
 * Anticipo en movil.
 *
 * El saldo va completo, con su barra: en el telefono es justo la pregunta que se hace
 * quien consulta —cuanto le queda por descontar a esta persona—.
 */
export function AdvanceCard({ advance, onDelete }: Props) {
    return (
        <article className="emp-card p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                        {formatDate(advance.date)}
                    </p>
                    <Link
                        href={route('advances.show', advance.id)}
                        className="mt-0.5 block truncate text-[14px] capitalize"
                        style={{ color: 'var(--emp-text)' }}
                    >
                        {employeeName(advance)}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        {advance.reason}
                    </p>
                </div>

                <div className="flex shrink-0 items-start gap-1">
                    <span className="text-[15px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(advance.amount)}
                    </span>
                    <AdvanceActionsMenu advance={advance} onDelete={onDelete} />
                </div>
            </div>

            <div className="mt-2.5 flex items-end gap-3">
                <div className="min-w-0 flex-1">
                    <AdvanceBalanceCell advance={advance} />
                </div>
                <AdvanceStatePill advance={advance} />
            </div>
        </article>
    );
}

export default AdvanceCard;
