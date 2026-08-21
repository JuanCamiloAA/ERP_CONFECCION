import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';

interface Props {
    /** Valor unitario que reciben por la referencia. */
    paymentPerUnit: number;
    /** Costo operacional unitario: suma de precios del detalle de operaciones. */
    productionCostPerUnit: number;
    /** Unidades del lote declaradas en el formulario. */
    lote: number;
    currency: string;
    /** Bloques propios de cada pantalla (checklist al crear, produccion e historial al editar). */
    children?: ReactNode;
}

const Bloque = ({ kicker, children }: { kicker: string; children: ReactNode }) => (
    <div className="px-[22px] py-[18px]" style={{ borderBottom: '1px solid var(--ref-border)' }}>
        <p className="ref-kicker">{kicker}</p>
        <div className="mt-2.5">{children}</div>
    </div>
);

/**
 * Economia de la referencia.
 *
 * Va en la columna fija de escritorio, de modo que el margen unitario esta a la vista
 * desde cualquier punto del formulario. No lleva calculadora de cantidad libre: el lote
 * ya dice cuantas unidades son, y dos cifras distintas de «total» confunden mas de lo
 * que ayudan.
 */
export function ReferenceEconomicsPanel({ paymentPerUnit, productionCostPerUnit, lote, currency, children }: Props) {
    const margen = Math.round((paymentPerUnit - productionCostPerUnit) * 100) / 100;
    const porcentaje = paymentPerUnit > 0 ? Math.round((margen / paymentPerUnit) * 1000) / 10 : null;
    const negativo = margen < 0;

    // Reparto de la barra: costo primero, margen despues. Con pago 0 no hay nada que repartir.
    const base = Math.max(paymentPerUnit, productionCostPerUnit);
    const anchoCosto = base > 0 ? Math.min(100, (productionCostPerUnit / base) * 100) : 0;

    const totalPago = Math.round(paymentPerUnit * lote * 100) / 100;
    const totalCosto = Math.round(productionCostPerUnit * lote * 100) / 100;
    const totalMargen = Math.round((totalPago - totalCosto) * 100) / 100;

    return (
        <div>
            <Bloque kicker="Margen unitario">
                <div className="flex items-baseline gap-2">
                    <span
                        className="text-[34px] leading-none"
                        style={{ color: negativo ? 'var(--ref-danger)' : 'var(--ref-text)' }}
                    >
                        {formatCurrency(margen, currency)}
                    </span>
                    {porcentaje !== null ? (
                        <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{
                                backgroundColor: negativo ? 'color-mix(in srgb, var(--ref-danger) 14%, transparent)' : 'var(--ref-accent-soft)',
                                color: negativo ? 'var(--ref-danger)' : 'var(--ref-accent-on)',
                            }}
                        >
                            {porcentaje}%
                        </span>
                    ) : null}
                </div>

                {/* Barra apilada: cuanto del pago se va en costo. */}
                <div
                    className="mt-3 flex h-1.5 overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--ref-accent-track)' }}
                    aria-hidden="true"
                >
                    <span style={{ width: `${anchoCosto}%`, backgroundColor: 'var(--ref-accent-on)' }} />
                    <span style={{ width: `${100 - anchoCosto}%`, backgroundColor: 'var(--ref-accent)' }} />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--ref-muted)' }}>
                    <span>Costo {formatCurrency(productionCostPerUnit, currency)}</span>
                    <span>Pago {formatCurrency(paymentPerUnit, currency)}</span>
                </div>

                {/* Con margen negativo hay que decirlo, no solo pintarlo de rojo. */}
                {negativo ? (
                    <p className="mt-2.5 text-[12px]" style={{ color: 'var(--ref-danger)' }}>
                        El costo operacional supera el pago: cada unidad se produce a pérdida.
                    </p>
                ) : null}
            </Bloque>

            <Bloque kicker={lote > 0 ? `Lote de ${lote.toLocaleString('es-CO')} unidades` : 'Lote'}>
                {lote > 0 ? (
                    <dl className="space-y-1.5 text-[12px]">
                        <div className="flex items-center justify-between">
                            <dt style={{ color: 'var(--ref-muted)' }}>Total pago</dt>
                            <dd style={{ color: 'var(--ref-text)' }}>{formatCurrency(totalPago, currency)}</dd>
                        </div>
                        <div className="flex items-center justify-between">
                            <dt style={{ color: 'var(--ref-muted)' }}>Total operacional</dt>
                            <dd style={{ color: 'var(--ref-text)' }}>{formatCurrency(totalCosto, currency)}</dd>
                        </div>
                        <div
                            className="flex items-center justify-between pt-2"
                            style={{ borderTop: '1px solid var(--ref-border)' }}
                        >
                            <dt style={{ color: 'var(--ref-muted)' }}>Margen del lote</dt>
                            <dd className="text-[15px]" style={{ color: totalMargen < 0 ? 'var(--ref-danger)' : 'var(--ref-text)' }}>
                                {formatCurrency(totalMargen, currency)}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                        Indica la cantidad del lote para ver los totales.
                    </p>
                )}
            </Bloque>

            {children}
        </div>
    );
}

/** Bloque del panel, para que cada pantalla componga los suyos con el mismo marco. */
export function ReferenceEconomicsBlock({ kicker, children }: { kicker: string; children: ReactNode }) {
    return <Bloque kicker={kicker}>{children}</Bloque>;
}
