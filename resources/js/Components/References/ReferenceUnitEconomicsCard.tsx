import { useMemo, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/Components/UI/Badge';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { cn, formatCurrency } from '@/lib/utils';

export interface ReferenceUnitEconomicsCardProps {
    /** Valor unitario que reciben por la referencia (puede ser 0 si aún no está cargado). */
    paymentPerUnit: number;
    /** Costo operacional unitario fijado al crear la referencia (no se recalcula al activar/desactivar operaciones). */
    productionCostPerUnit: number;
    /** Hay al menos una operacion vinculada (pivot). */
    hasOperations: boolean;
    currency?: string;
    /** true si en BD el precio de pago es null (referencia legacy). */
    paymentIncomplete?: boolean;
    className?: string;
    /** Unidades del lote declaradas al momento de fijar el costo (al crear). */
    operationalLotQtyAtCostFix?: number;
    totalOperationalAtCreation?: number;
}

export function ReferenceUnitEconomicsCard({
    paymentPerUnit,
    productionCostPerUnit,
    hasOperations,
    currency = 'COP',
    paymentIncomplete = false,
    className,
    operationalLotQtyAtCostFix,
    totalOperationalAtCreation,
}: ReferenceUnitEconomicsCardProps) {
    const [quantity, setQuantity] = useState(1);
    const safeQty = Math.max(1, Number.isFinite(quantity) ? Math.floor(quantity) : 1);

    const showCostFigures = hasOperations || productionCostPerUnit > 0;

    const marginPerUnit = useMemo(
        () => Math.round((paymentPerUnit - productionCostPerUnit) * 100) / 100,
        [paymentPerUnit, productionCostPerUnit],
    );
    const totalPayment = Math.round(paymentPerUnit * safeQty * 100) / 100;
    const totalCost = Math.round(productionCostPerUnit * safeQty * 100) / 100;
    const marginTotal = Math.round((totalPayment - totalCost) * 100) / 100;
    const marginPctOnPayment = paymentPerUnit > 0 ? Math.round((marginPerUnit / paymentPerUnit) * 10_000) / 100 : null;

    const lotSnap = operationalLotQtyAtCostFix ?? 0;
    const totalSnap = totalOperationalAtCreation ?? 0;

    return (
        <Card className={className}>
            <CardHeader
                title="Comparativo economico"
                description="El costo operacional unitario se fija solo al crear la referencia (suma de precios de las operaciones vinculadas y el lote superior). No cambia si desactiva operaciones despues."
            />
            <div className="mt-4 space-y-4">
                {paymentIncomplete && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                        <span>Falta registrar el valor unitario de pago. Complete el dato para un comparativo fiable.</span>
                        <Badge variant="warning" className="text-xs">
                            Incompleto
                        </Badge>
                    </div>
                )}

                {lotSnap > 0 && totalSnap > 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Al crear la referencia, con un lote de <strong>{lotSnap.toLocaleString()}</strong> unidades, el{' '}
                        <strong>costo operacional total</strong> estimado fue <strong>{formatCurrency(totalSnap, currency)}</strong>.
                    </p>
                )}

                {!showCostFigures ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Sin operaciones vinculadas y sin costo fijo registrado. Al crear la referencia incluya operaciones para fijar el costo
                        operacional.
                    </p>
                ) : hasOperations && productionCostPerUnit === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Costo operacional unitario fijo al crear: 0 (la suma de precios de operaciones al guardar fue 0).
                    </p>
                ) : null}

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full min-w-[280px] text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr className="text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                <th className="px-3 py-2">Concepto</th>
                                <th className="px-3 py-2 text-right">Unitario</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            <tr>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Precio de pago (unitario)</td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                    {formatCurrency(paymentPerUnit, currency)}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Costo operacional fijo (u.)</td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                    {showCostFigures ? formatCurrency(productionCostPerUnit, currency) : '—'}
                                </td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Margen unitario</td>
                                <td
                                    className={cn(
                                        'px-3 py-2 text-right font-semibold tabular-nums',
                                        marginPerUnit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                                    )}
                                >
                                    {showCostFigures ? formatCurrency(marginPerUnit, currency) : '—'}
                                    {marginPctOnPayment != null && showCostFigures ? (
                                        <span className="ml-1 text-xs font-normal text-slate-500">({marginPctOnPayment}% sobre pago)</span>
                                    ) : null}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                    <Input
                        label="Cantidad de unidades"
                        type="number"
                        min={1}
                        step={1}
                        value={String(safeQty)}
                        onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setQuantity(Number.isNaN(n) || n < 1 ? 1 : n);
                        }}
                        className="max-w-xs"
                    />
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-slate-500 dark:text-slate-400">Total precio de pago</dt>
                            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(totalPayment, currency)}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500 dark:text-slate-400">Total costo operacional</dt>
                            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                {showCostFigures ? formatCurrency(totalCost, currency) : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500 dark:text-slate-400">Margen total</dt>
                            <dd
                                className={cn(
                                    'font-semibold tabular-nums',
                                    !showCostFigures ? 'text-slate-400' : marginTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                                )}
                            >
                                {showCostFigures ? formatCurrency(marginTotal, currency) : '—'}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </Card>
    );
}
