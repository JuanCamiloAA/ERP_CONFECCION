import { ADVANCE_STATE_LABEL, advanceState } from '@/lib/advances';
import type { Advance } from '@/types';

/**
 * Estado del anticipo, siempre en palabras y capitalizado.
 *
 * «Parcial» lleva acento porque es el unico que exige atencion: hay dinero entregado que
 * todavia viaja al siguiente periodo.
 */
export function AdvanceStatePill({ advance }: { advance: Pick<Advance, 'status' | 'amount' | 'remaining_amount'> }) {
    const state = advanceState(advance);

    if (state === 'parcial') {
        return <span className="emp-pill emp-pill-accent">{ADVANCE_STATE_LABEL.parcial}</span>;
    }

    return (
        <span className="emp-pill" style={state === 'descontado' ? { color: 'var(--emp-subtle)' } : undefined}>
            {ADVANCE_STATE_LABEL[state]}
        </span>
    );
}

export default AdvanceStatePill;
