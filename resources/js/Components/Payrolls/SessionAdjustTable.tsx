import { Link } from '@inertiajs/react';
import { CaretRight } from '@phosphor-icons/react';
import type { PayrollEditors } from '@/Components/Payrolls/usePayrollEdits';
import { clockLabel, editKey, hoursFromMinutes, sessionMinutes } from '@/lib/payrolls';
import { formatDate, formatNumber } from '@/lib/utils';
import type { WorkDaySession } from '@/types';

/** Reticula de la tabla de jornadas, compartida por la cabecera y las filas. */
export const SESSION_GRID = '96px 92px 76px 76px 84px 116px minmax(0,1fr)';

const COLUMNS = ['Fecha', 'Estado', 'Entrada', 'Salida', 'Minutos', 'Ajuste min.', 'Motivo'];

interface Props {
    employeeId: number;
    sessions: WorkDaySession[];
    editors: PayrollEditors;
    /** Nomina en `calculado` y permiso `payrolls.show.edit_time`. */
    canEdit: boolean;
    /** Muestra solo las N primeras; el resto se consulta en la ficha completa. */
    limit?: number;
    moreHref?: string;
}

/**
 * Jornadas del periodo con su ajuste de minutos.
 *
 * Solo se pueden tocar las sesiones cerradas o ya ajustadas que tengan salida marcada: una
 * sesion abierta todavia puede cambiar sola, y ajustarla a mano dejaria dos verdades sobre
 * el mismo dia. El motivo queda escrito en la sesion, que es donde se audita despues.
 */
export function SessionAdjustTable({ employeeId, sessions, editors, canEdit, limit, moreHref }: Props) {
    const totalMinutes = sessionMinutes(sessions);
    const visible = limit != null ? sessions.slice(0, limit) : sessions;
    const hidden = sessions.length - visible.length;

    if (sessions.length === 0) {
        return (
            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                No hay jornadas registradas en este periodo.
            </p>
        );
    }

    const rowState = (session: WorkDaySession) => {
        const key = editKey(employeeId, session.id);
        const editable = canEdit && (session.status === 'closed' || session.status === 'adjusted') && !! session.clock_out_at;
        const fallback = { duration_minutes: String(session.duration_minutes ?? ''), reason: '' };
        const edit = editors.sessionEdits[key] ?? fallback;
        const touched = editors.sessionEdits[key] !== undefined || session.status === 'adjusted';

        return { key, editable, fallback, edit, touched };
    };

    return (
        <div>
            {/* Escritorio: rejilla. */}
            <div className="hidden lg:block">
                <div
                    className="grid items-center gap-2.5 px-3 pb-2"
                    style={{ gridTemplateColumns: SESSION_GRID, borderBottom: '1px solid var(--emp-border)' }}
                >
                    {COLUMNS.map((column) => (
                        <span
                            key={column}
                            className="text-[11px] uppercase tracking-[0.09em]"
                            style={{ color: 'var(--emp-subtle)' }}
                        >
                            {column}
                        </span>
                    ))}
                </div>

                {visible.map((session) => {
                    const { key, editable, fallback, edit, touched } = rowState(session);

                    return (
                        <div
                            key={session.id}
                            className="emp-row-sep grid items-center gap-2.5 px-3 py-2"
                            style={{
                                gridTemplateColumns: SESSION_GRID,
                                ...(touched ? { backgroundColor: 'var(--emp-row-hover)' } : {}),
                            }}
                        >
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {formatDate(session.work_date)}
                            </span>
                            <span className="text-[12px] capitalize" style={{ color: 'var(--emp-muted)' }}>
                                {session.status}
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                {clockLabel(session.clock_in_at)}
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                {clockLabel(session.clock_out_at)}
                            </span>
                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {session.duration_minutes ?? '—'}
                            </span>

                            {editable ? (
                                <input
                                    type="number"
                                    min={0}
                                    max={2000}
                                    value={edit.duration_minutes}
                                    onChange={(e) =>
                                        editors.setSessionEdit(key, { duration_minutes: e.target.value }, fallback)
                                    }
                                    aria-label={`Ajuste de minutos del ${formatDate(session.work_date)}`}
                                    className="emp-field"
                                    style={touched ? { borderColor: 'var(--emp-accent)' } : undefined}
                                />
                            ) : (
                                <span className="text-[12.5px]" style={{ color: 'var(--emp-faint)' }}>
                                    —
                                </span>
                            )}

                            {editable ? (
                                <input
                                    value={edit.reason}
                                    onChange={(e) => editors.setSessionEdit(key, { reason: e.target.value }, fallback)}
                                    placeholder="Motivo (opcional)"
                                    aria-label={`Motivo del ajuste del ${formatDate(session.work_date)}`}
                                    className="emp-field"
                                    style={touched ? { borderColor: 'var(--emp-accent)' } : undefined}
                                />
                            ) : (
                                <span className="truncate text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                    {session.notes || '—'}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Movil: una tarjeta por jornada, con los campos a 44 px. */}
            <div className="flex flex-col gap-2 lg:hidden">
                {visible.map((session) => {
                    const { key, editable, fallback, edit, touched } = rowState(session);

                    return (
                        <div
                            key={session.id}
                            className="rounded-[10px] p-2.5"
                            style={{
                                border: `1px solid ${touched ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                backgroundColor: 'var(--emp-field-alt)',
                            }}
                        >
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                    {formatDate(session.work_date)}
                                </span>
                                <span className="text-[11px] capitalize" style={{ color: 'var(--emp-subtle)' }}>
                                    {session.status} · {session.duration_minutes ?? '—'} min
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                {clockLabel(session.clock_in_at)} – {clockLabel(session.clock_out_at)}
                            </p>

                            {editable ? (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="emp-label" htmlFor={`min-${session.id}`}>
                                            Ajuste min.
                                        </label>
                                        <input
                                            id={`min-${session.id}`}
                                            type="number"
                                            min={0}
                                            max={2000}
                                            value={edit.duration_minutes}
                                            onChange={(e) =>
                                                editors.setSessionEdit(key, { duration_minutes: e.target.value }, fallback)
                                            }
                                            aria-label={`Ajuste de minutos del ${formatDate(session.work_date)}`}
                                            className="emp-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="emp-label" htmlFor={`reason-${session.id}`}>
                                            Motivo
                                        </label>
                                        <input
                                            id={`reason-${session.id}`}
                                            value={edit.reason}
                                            onChange={(e) =>
                                                editors.setSessionEdit(key, { reason: e.target.value }, fallback)
                                            }
                                            placeholder="Opcional"
                                            aria-label={`Motivo del ajuste del ${formatDate(session.work_date)}`}
                                            className="emp-field"
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    {formatNumber(sessions.length)} {sessions.length === 1 ? 'jornada' : 'jornadas'} ·{' '}
                    {formatNumber(totalMinutes)} min · {hoursFromMinutes(totalMinutes)} h
                </p>

                {hidden > 0 && moreHref ? (
                    <Link
                        href={moreHref}
                        className="inline-flex items-center gap-1 text-[12px]"
                        style={{ color: 'var(--emp-accent-on)' }}
                    >
                        Ver las {formatNumber(sessions.length)} jornadas
                        <CaretRight size={12} />
                    </Link>
                ) : null}
            </div>
        </div>
    );
}

export default SessionAdjustTable;
