import { Link } from '@inertiajs/react';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import type { LegalParameterRow } from '@/lib/legalParameters';
import { formatDate } from '@/lib/utils';

export const LEGAL_PARAMETER_GRID = 'minmax(150px,1.1fr) 96px 92px 132px minmax(96px,0.9fr) 84px';

interface Props {
    parameters: LegalParameterRow[];
    isSuperAdmin: boolean;
    onDelete: (parameter: LegalParameterRow) => void;
}

const COLUMNS = [
    { label: 'Vigencia', right: false },
    { label: 'Alcance', right: false },
    { label: 'Jornada', right: true },
    { label: 'Franja nocturna', right: false },
    { label: 'Recargos', right: false },
    { label: '', right: false },
];

/**
 * Los tramos en una sola linea por tramo.
 *
 * La tarjeta explica un tramo; la tabla existe para comparar varios: que la jornada bajó de
 * 44 a 42 horas o que un recargo cambió solo se ve con las cifras alineadas en columna.
 */
export function LegalParameterTable({ parameters, isSuperAdmin, onDelete }: Props) {
    return (
        <div>
            <div
                className="grid items-center gap-2.5 px-3 pb-2"
                style={{ gridTemplateColumns: LEGAL_PARAMETER_GRID, borderBottom: '1px solid var(--emp-border)' }}
            >
                {COLUMNS.map((column, index) => (
                    <span
                        key={column.label || `col-${index}`}
                        className={`text-[11px] uppercase tracking-[0.09em] ${column.right ? 'text-right' : ''}`}
                        style={{ color: 'var(--emp-subtle)' }}
                    >
                        {column.label}
                    </span>
                ))}
            </div>

            {parameters.map((parameter) => {
                const editable = parameter.scope === 'company' || isSuperAdmin;

                return (
                    <div
                        key={parameter.id}
                        className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5"
                        style={{ gridTemplateColumns: LEGAL_PARAMETER_GRID }}
                    >
                        <div className="min-w-0">
                            <p className="truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                Desde {formatDate(parameter.effective_from)}
                            </p>
                            <p className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {parameter.effective_to
                                    ? `hasta ${formatDate(parameter.effective_to)}`
                                    : 'sin fecha de fin'}
                            </p>
                        </div>

                        <span className={`emp-pill ${parameter.scope === 'company' ? 'emp-pill-accent' : ''}`}>
                            {parameter.scope === 'company' ? 'Empresa' : 'Global'}
                        </span>

                        <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {parameter.weekly_legal_hours} h
                        </span>

                        <span className="truncate text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                            {parameter.night_start_time?.slice(0, 5)} – {parameter.night_end_time?.slice(0, 5)}
                        </span>

                        <span className="truncate text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                            noc. {parameter.night_surcharge_percent}% · ext. {parameter.overtime_day_percent}%
                        </span>

                        <div className="flex items-center justify-end gap-1">
                            {editable ? (
                                <>
                                    <Can permission="payroll_legal_parameters.index.edit">
                                        <Link
                                            href={route('payroll-legal-parameters.edit', parameter.id)}
                                            aria-label={`Editar el tramo desde ${formatDate(parameter.effective_from)}`}
                                            className="emp-btn emp-btn-sm emp-btn-ghost"
                                        >
                                            <PencilSimple size={14} />
                                        </Link>
                                    </Can>
                                    <Can permission="payroll_legal_parameters.index.delete">
                                        <button
                                            type="button"
                                            onClick={() => onDelete(parameter)}
                                            aria-label={`Eliminar el tramo desde ${formatDate(parameter.effective_from)}`}
                                            className="emp-btn emp-btn-sm emp-btn-ghost"
                                            style={{ color: 'var(--emp-danger)' }}
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </Can>
                                </>
                            ) : (
                                <span className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    Solo lectura
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default LegalParameterTable;
