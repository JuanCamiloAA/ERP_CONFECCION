import type { PayrollEditors } from '@/Components/Payrolls/usePayrollEdits';
import { advanceKey } from '@/lib/payrolls';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Advance, PayrollEmployee } from '@/types';

interface Props {
    row: PayrollEmployee;
    editors: PayrollEditors;
    canEdit: boolean;
}

/**
 * Anticipos que se descuentan en este periodo.
 *
 * Por defecto viaja el saldo pendiente completo; el monto se edita para descontar solo una
 * parte y dejar el resto para la nomina siguiente. Sin este control, un anticipo grande se
 * comia el neto entero del empleado y no habia forma de repartirlo.
 */
export function AdvanceDiscountList({ row, editors, canEdit }: Props) {
    const advances: Advance[] = row.advances ?? [];

    if (advances.length === 0) {
        return null;
    }

    return (
        <section className="emp-card p-[15px_16px]">
            <p className="emp-kicker">Anticipos a descontar</p>

            <div className="mt-2.5 flex flex-col gap-2">
                {advances.map((advance) => {
                    const key = advanceKey(row.employee_id, advance.id);
                    const remaining = Number(advance.remaining_amount);
                    const current =
                        editors.advanceEdits[key]?.applied_amount ?? String(advance.applied_amount ?? remaining);

                    return (
                        <div key={advance.id} className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                    {advance.reason}
                                </p>
                                <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    {formatDate(advance.date)} · saldo {formatCurrency(remaining)}
                                </p>
                            </div>

                            {canEdit ? (
                                // El ancho va en el contenedor: `.emp-field` fija `width:100%` desde
                                // una hoja sin capa y le gana a las utilidades de Tailwind.
                                <div className="w-[130px] shrink-0">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0.01}
                                        max={remaining}
                                        value={current}
                                        onChange={(e) => editors.setAdvanceEdit(key, e.target.value)}
                                        aria-label={`Monto a descontar del anticipo del ${formatDate(advance.date)}`}
                                        className="emp-field text-right"
                                    />
                                </div>
                            ) : (
                                <span
                                    className="w-[130px] shrink-0 text-right text-[13px] tabular-nums"
                                    style={{ color: 'var(--emp-danger)' }}
                                >
                                    − {formatCurrency(advance.applied_amount ?? remaining)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {canEdit ? (
                <p className="emp-help">Si descuentas menos, el resto viaja al siguiente periodo.</p>
            ) : null}
        </section>
    );
}

export default AdvanceDiscountList;
