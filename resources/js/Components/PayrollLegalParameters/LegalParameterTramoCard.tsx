import { Link } from '@inertiajs/react';
import { Check, PencilSimple, Trash } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import type { LegalParameterRow } from '@/lib/legalParameters';
import { formatDate, formatNumber } from '@/lib/utils';

interface Props {
    parameter: LegalParameterRow;
    isSuperAdmin: boolean;
    onDelete: (parameter: LegalParameterRow) => void;
}

/**
 * Un tramo de vigencia, con sus seis datos rotulados.
 *
 * La celda que decia «35% / 25% / 75% / 75%» con el orden explicado en el encabezado no
 * se podia auditar: aqui cada numero lleva su nombre encima.
 */
export function LegalParameterTramoCard({ parameter, isSuperAdmin, onDelete }: Props) {
    const canWrite = parameter.scope === 'company' || isSuperAdmin;

    const cells = [
        {
            label: 'Jornada',
            value: `${formatNumber(parameter.weekly_legal_hours)} h / ${formatNumber(parameter.monthly_hours_divisor)}`,
        },
        { label: 'Nocturno', value: `${parameter.night_start_time}–${parameter.night_end_time}` },
        { label: 'Recargo noct.', value: `${formatNumber(parameter.night_surcharge_percent)}%` },
        {
            label: 'Extra d. / n.',
            value: `${formatNumber(parameter.overtime_day_percent)}% / ${formatNumber(parameter.overtime_night_percent)}%`,
        },
        { label: 'Dom-festivo', value: `${formatNumber(parameter.sunday_holiday_surcharge_percent)}%` },
        {
            label: 'Inasistencia',
            value: parameter.discount_unexcused_absences
                ? `${formatNumber(parameter.absence_discount_percent)}% activo`
                : 'Desactivado',
        },
    ];

    return (
        <article className={`emp-card p-[14px_16px] ${parameter.is_active ? '' : 'emp-row-off'}`}>
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                            {formatDate(parameter.effective_from)} —{' '}
                            {parameter.effective_to ? formatDate(parameter.effective_to) : 'indefinido'}
                        </h3>
                        <span className={`emp-pill ${parameter.scope === 'company' ? 'emp-pill-accent' : ''}`}>
                            {parameter.scope === 'company' ? 'Esta empresa' : 'Global'}
                        </span>
                        {parameter.is_active ? (
                            <span className="emp-pill emp-pill-accent">
                                <Check size={12} />
                                Vigente
                            </span>
                        ) : null}
                    </div>
                    {parameter.legal_reference ? (
                        <p className="mt-1 text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                            {parameter.legal_reference}
                        </p>
                    ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {canWrite ? (
                        <>
                            <Can permission="payroll_legal_parameters.index.edit">
                                <Link
                                    href={route('payroll-legal-parameters.edit', parameter.id)}
                                    aria-label="Editar tramo"
                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                    style={{ color: 'var(--emp-muted)' }}
                                >
                                    <PencilSimple size={15} />
                                </Link>
                            </Can>
                            <Can permission="payroll_legal_parameters.index.delete">
                                <button
                                    type="button"
                                    onClick={() => onDelete(parameter)}
                                    aria-label="Eliminar tramo"
                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                    style={{ color: 'var(--emp-danger)' }}
                                >
                                    <Trash size={15} />
                                </button>
                            </Can>
                        </>
                    ) : (
                        <span className="text-[11px]" style={{ color: 'var(--emp-faint)' }}>
                            Solo lectura
                        </span>
                    )}
                </div>
            </header>

            <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))' }}>
                {cells.map((cell) => (
                    <div key={cell.label} className="min-w-0">
                        <p className="emp-kicker">{cell.label}</p>
                        <p className="mt-0.5 text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {cell.value}
                        </p>
                    </div>
                ))}
            </div>
        </article>
    );
}

export default LegalParameterTramoCard;
