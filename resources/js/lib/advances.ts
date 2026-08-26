import type { Advance } from '@/types';

/**
 * Estado real de un anticipo.
 *
 * La base solo guarda dos (`pendiente` / `descontado`), pero el descuento puede ser
 * parcial: la nomina baja `remaining_amount` y deja el estado en `pendiente` hasta que
 * llega a cero. Un anticipo a medio cubrir mostrado como «pendiente» hace pensar que no
 * se ha tocado, asi que aqui se deriva el tercer estado sin tocar la base.
 */
export type AdvanceState = 'pendiente' | 'parcial' | 'descontado';

export function advanceState(advance: Pick<Advance, 'status' | 'amount' | 'remaining_amount'>): AdvanceState {
    const remaining = Number(advance.remaining_amount);

    if (advance.status === 'descontado' || remaining <= 0) {
        return 'descontado';
    }

    return remaining < Number(advance.amount) ? 'parcial' : 'pendiente';
}

export const ADVANCE_STATE_LABEL: Record<AdvanceState, string> = {
    pendiente: 'Pendiente',
    parcial: 'Parcial',
    descontado: 'Descontado',
};

/** Cuanto del anticipo ya se descontó, de 0 a 100. */
export function coveredPercent(advance: Pick<Advance, 'amount' | 'remaining_amount'>): number {
    const amount = Number(advance.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }

    const covered = ((amount - Number(advance.remaining_amount)) / amount) * 100;

    return Math.max(0, Math.min(100, Math.round(covered)));
}

/** Lo ya descontado en dinero: el complemento del saldo. */
export function appliedAmount(advance: Pick<Advance, 'amount' | 'remaining_amount'>): number {
    return Math.max(0, Number(advance.amount) - Number(advance.remaining_amount));
}

/**
 * Un anticipo solo se puede borrar mientras no tenga ningun descuento aplicado.
 *
 * Es la misma regla que aplica el servidor (AdvanceController::destroy); se repite aqui
 * para no ofrecer un boton que va a ser rechazado.
 */
export function canDeleteAdvance(advance: Pick<Advance, 'amount' | 'remaining_amount'>): boolean {
    return Number(advance.remaining_amount) === Number(advance.amount);
}
