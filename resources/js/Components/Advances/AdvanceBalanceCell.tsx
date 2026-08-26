import { advanceState, coveredPercent } from '@/lib/advances';
import { formatCurrency } from '@/lib/utils';
import type { Advance } from '@/types';

/**
 * Saldo por descontar, con lo cubierto hasta ahora.
 *
 * Es la cifra que el listado escondia: sin ella no se sabe cuanto dinero sigue viajando
 * al siguiente periodo. Cerrado el anticipo, el saldo deja de ser un numero y pasa a ser
 * un guion —cero no es un dato util— y la barra se apaga.
 */
export function AdvanceBalanceCell({ advance }: { advance: Pick<Advance, 'status' | 'amount' | 'remaining_amount'> }) {
    const closed = advanceState(advance) === 'descontado';
    const covered = coveredPercent(advance);

    return (
        <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
                <span
                    className="text-[14px] tabular-nums"
                    style={{ color: closed ? 'var(--emp-subtle)' : 'var(--emp-accent-on)' }}
                >
                    {closed ? '—' : formatCurrency(advance.remaining_amount)}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                    {covered}% cubierto
                </span>
            </div>

            <div
                aria-hidden="true"
                className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--emp-row)' }}
            >
                <span
                    className="block h-full rounded-full"
                    style={{ width: `${covered}%`, backgroundColor: closed ? 'var(--emp-faint)' : 'var(--emp-accent)' }}
                />
            </div>
        </div>
    );
}

export default AdvanceBalanceCell;
