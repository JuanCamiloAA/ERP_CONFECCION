import { router } from '@inertiajs/react';
import { CaretDown, Clock } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Can } from '@/Components/UI/Can';
import type { Employee } from '@/types';
import '../../../css/module-ui.css';

type SessionJson = {
    id: number;
    status: string;
    clock_in_at?: string | null;
    clock_out_at?: string | null;
    duration_minutes?: number | null;
};

export type WorkDayBannerPayload = {
    work_date: string;
    mode?: string;
    employee_id?: number;
    open: SessionJson | null;
    closed: SessionJson | null;
    long_shift_warning?: boolean;
};

type TodayResponse = WorkDayBannerPayload & { applicable: boolean };

interface Props {
    variant: 'self' | 'admin';
    /** Estado del dia para el empleado enlazado (servidor). */
    initialSelf?: WorkDayBannerPayload | null;
    selectableEmployees?: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
    /** Nota al pie de la tarjeta; la usa el formulario de registro. */
    note?: string;
}

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

/** Cabecera comun de las dos variantes: reloj, titulo y fecha. */
function BannerHead({ title, meta }: { title: string; meta?: string }) {
    return (
        <div className="flex items-start gap-2.5">
            <Clock size={19} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-accent-line)' }} />
            <div className="min-w-0">
                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </p>
                {meta ? (
                    <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                        {meta}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Control de jornada.
 *
 * `self` es la jornada del propio operario y vive arriba de su listado: es su primera
 * accion del dia. `admin` abre o cierra la jornada de otra persona y vive solo en el
 * formulario de registro, que es donde esa accion tiene contexto; en el listado ocupaba
 * la primera pantalla sin decir nada de la produccion del dia.
 *
 * La logica no cambia: mismo `TodayResponse`, mismo `axios.get` y mismos `router.post`.
 */
export function WorkDayBanner({ variant, initialSelf, selectableEmployees = [], note }: Props) {
    const [adminEmployeeId, setAdminEmployeeId] = useState('');
    const [adminState, setAdminState] = useState<TodayResponse | null>(null);

    const loadAdmin = useCallback(async (employeeId: number) => {
        const { data } = await axios.get<TodayResponse>(route('work-day-sessions.today'), {
            params: { employee_id: employeeId },
        });
        setAdminState(data.applicable ? data : null);
    }, []);

    useEffect(() => {
        if (variant !== 'admin') {
            return;
        }
        if (!adminEmployeeId) {
            setAdminState(null);

            return;
        }
        loadAdmin(Number(adminEmployeeId)).catch(() => setAdminState(null));
    }, [variant, adminEmployeeId, loadAdmin]);

    /* --------------------------------------------------------- jornada propia */

    if (variant === 'self') {
        if (!initialSelf) {
            return null;
        }

        const { work_date, open, closed, long_shift_warning } = initialSelf;

        const start = () => {
            router.post(route('work-day-sessions.start'), {}, { preserveScroll: true });
        };

        const close = () => {
            if (!open?.id) return;
            router.post(route('work-day-sessions.close', open.id), {}, { preserveScroll: true });
        };

        const meta = [
            work_date,
            open ? `abierta ${formatTime(open.clock_in_at)}` : null,
            closed ? `cerrada · ${closed.duration_minutes ?? 0} min` : null,
        ]
            .filter(Boolean)
            .join(' · ');

        return (
            <div className="emp-form emp-card p-[17px]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <BannerHead title="Jornada de hoy" meta={meta} />

                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Can permission="productions.index.workday_start">
                            <button type="button" onClick={start} disabled={!!open || !!closed} className="emp-btn emp-btn-sm emp-btn-primary">
                                Iniciar jornada
                            </button>
                        </Can>
                        <Can permission="productions.index.workday_close">
                            <button type="button" onClick={close} disabled={!open} className="emp-btn emp-btn-sm">
                                Cerrar jornada
                            </button>
                        </Can>
                    </div>
                </div>

                {long_shift_warning ? (
                    <p className="emp-note mt-3">Jornada muy larga (más de 12 h). Verifica las horas con supervisor.</p>
                ) : null}

                {note ? <p className="emp-note mt-3">{note}</p> : null}
            </div>
        );
    }

    /* ------------------------------------------------------ jornada de otro */

    const state = adminState;
    const open = state?.open ?? null;
    const closed = state?.closed ?? null;

    const startAdmin = () => {
        if (!adminEmployeeId) return;
        router.post(route('work-day-sessions.start'), { employee_id: Number(adminEmployeeId) }, { preserveScroll: true });
    };

    const closeAdmin = () => {
        if (!open?.id) return;
        router.post(route('work-day-sessions.close', open.id), {}, { preserveScroll: true });
    };

    const meta = state
        ? [
              state.work_date,
              open ? `abierta ${formatTime(open.clock_in_at)}` : null,
              closed ? `cerrada · ${closed.duration_minutes ?? 0} min` : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : undefined;

    return (
        <div className="emp-form emp-card p-[17px]">
            <BannerHead title="Control de jornada" meta={meta} />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <label className="emp-label" htmlFor="workday-employee">
                        Empleado (salario diario)
                    </label>
                    <div className="relative">
                        <select
                            id="workday-employee"
                            value={adminEmployeeId}
                            onChange={(e) => setAdminEmployeeId(e.target.value)}
                            className="emp-field"
                        >
                            <option value="">Seleccionar…</option>
                            {selectableEmployees.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.first_name} {e.last_name}
                                </option>
                            ))}
                        </select>
                        <CaretDown
                            size={13}
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                    </div>
                </div>

                <div className="flex shrink-0 gap-2">
                    <Can permission="productions.index.workday_start">
                        <button
                            type="button"
                            onClick={startAdmin}
                            disabled={!adminEmployeeId || !!open || !!closed}
                            className="emp-btn emp-btn-sm emp-btn-primary"
                        >
                            Iniciar
                        </button>
                    </Can>
                    <Can permission="productions.index.workday_close">
                        <button type="button" onClick={closeAdmin} disabled={!open} className="emp-btn emp-btn-sm">
                            Cerrar
                        </button>
                    </Can>
                </div>
            </div>

            {adminEmployeeId && state?.long_shift_warning ? (
                <p className="emp-note mt-3">Jornada muy larga (más de 12 h).</p>
            ) : null}

            {adminEmployeeId && !state ? (
                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    Sin datos de jornada para esta selección.
                </p>
            ) : null}

            {note ? <p className="emp-note mt-3">{note}</p> : null}
        </div>
    );
}
