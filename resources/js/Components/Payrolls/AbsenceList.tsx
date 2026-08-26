import { Link } from '@inertiajs/react';
import type { PayrollEditors } from '@/Components/Payrolls/usePayrollEdits';
import { usePermissions } from '@/contexts/PermissionsContext';
import { absenceKey } from '@/lib/payrolls';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PayrollEmployee } from '@/types';

interface Props {
    row: PayrollEmployee;
    /** Solo la modalidad por horas descuenta el dia; en salario diario el bloque informa. */
    isHourlyLegal: boolean;
    editors: PayrollEditors;
    canEdit: boolean;
}

/**
 * Dias habiles esperados sin jornada cerrada.
 *
 * Se listan siempre, incluso cuando no descuentan: es la unica forma de ver que el sistema
 * los detecto y decidir si se justifican. Desmarcar y anotar el motivo los excluye del
 * descuento en el siguiente recalculo.
 */
export function AbsenceList({ row, isHourlyLegal, editors, canEdit }: Props) {
    const perms = usePermissions();
    const detail = row.absence_discount_detail ?? [];
    const editable = isHourlyLegal && canEdit;

    return (
        <section className="emp-card p-[15px_16px]">
            <p className="emp-kicker">Días sin marcación</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                {isHourlyLegal
                    ? 'Días hábiles esperados sin jornada cerrada. Desmarca y anota un motivo para excluirlos del descuento antes de recalcular.'
                    : 'Solo informativo: en salario diario el día no se paga al no existir sesión; esto no resta nada adicional.'}
            </p>

            {detail.length === 0 ? (
                <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                    No hay días hábiles esperados sin marcar en este periodo.
                </p>
            ) : (
                <div className="mt-2.5 flex flex-col gap-2">
                    {detail.map((item) => {
                        const key = absenceKey(row.employee_id, item.work_date);
                        const fallback = { discount: item.confirmed, note: item.note ?? '' };
                        const state = editors.absenceEdits[key] ?? fallback;

                        return (
                            <div key={item.work_date} className="flex flex-wrap items-center gap-2">
                                {isHourlyLegal ? (
                                    <label className="flex h-11 shrink-0 cursor-pointer items-center sm:h-auto">
                                        <input
                                            type="checkbox"
                                            checked={state.discount}
                                            disabled={! editable}
                                            onChange={(e) =>
                                                editors.setAbsenceEdit(key, { discount: e.target.checked }, fallback)
                                            }
                                            aria-label={`Descontar el día ${formatDate(item.work_date)}`}
                                            className="h-5 w-5 rounded"
                                            style={{ accentColor: 'var(--emp-accent)' }}
                                        />
                                    </label>
                                ) : null}

                                <span
                                    className="w-[86px] shrink-0 text-[12.5px] tabular-nums"
                                    style={{ color: 'var(--emp-text)' }}
                                >
                                    {formatDate(item.work_date)}
                                </span>

                                {isHourlyLegal ? (
                                    <span
                                        className="w-[92px] shrink-0 text-[12.5px] tabular-nums"
                                        style={{ color: 'var(--emp-danger)' }}
                                    >
                                        − {formatCurrency(item.computed_amount)}
                                    </span>
                                ) : null}

                                {editable ? (
                                    // `.emp-field` fija `width:100%;min-width:0` desde una hoja sin
                                    // capa, así que el suelo de ancho tiene que ir en el contenedor.
                                    <div className="min-w-[150px] flex-1">
                                        <input
                                            value={state.note}
                                            onChange={(e) =>
                                                editors.setAbsenceEdit(key, { note: e.target.value }, fallback)
                                            }
                                            placeholder="Motivo si se justifica (opcional)"
                                            aria-label={`Motivo del día ${formatDate(item.work_date)}`}
                                            className="emp-field"
                                        />
                                    </div>
                                ) : (
                                    <span className="min-w-0 flex-1 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {item.note || '—'}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {isHourlyLegal ? (
                        <p className="emp-help">
                            Si el descuento no cambia al recalcular, revisa que «Descontar día hábil sin marcación» esté
                            activo en{' '}
                            {perms.can('payroll_legal_parameters.index.view') ? (
                                <Link
                                    href={route('payroll-legal-parameters.index')}
                                    className="underline underline-offset-2"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                >
                                    Parámetros legales
                                </Link>
                            ) : (
                                'Parámetros legales'
                            )}{' '}
                            para esta empresa.
                        </p>
                    ) : null}
                </div>
            )}
        </section>
    );
}

export default AbsenceList;
