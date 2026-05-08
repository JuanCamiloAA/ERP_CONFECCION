import { router } from '@inertiajs/react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card } from '@/Components/UI/Card';
import { Select } from '@/Components/UI/Select';
import type { Employee } from '@/types';

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
}

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

export function WorkDayBanner({ variant, initialSelf, selectableEmployees = [] }: Props) {
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

        return (
            <Card className="border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <ClockIcon className="mt-0.5 h-8 w-8 shrink-0 text-indigo-600 dark:text-indigo-400" />
                        <div>
                            <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">Jornada de hoy</p>
                            <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">Fecha: {work_date}</p>
                            {open && (
                                <p className="mt-1 text-sm text-indigo-900 dark:text-indigo-100">
                                    Entrada: {formatTime(open.clock_in_at)}
                                </p>
                            )}
                            {closed && (
                                <p className="mt-1 text-sm text-indigo-900 dark:text-indigo-100">
                                    Cerrada — {closed.duration_minutes ?? 0} min
                                </p>
                            )}
                            {long_shift_warning && (
                                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                                    Jornada muy larga (&gt;12 h). Verifica las horas con supervisor.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Can permission="productions.index.workday_start">
                            <Button type="button" onClick={start} disabled={!!open || !!closed}>
                                Iniciar jornada
                            </Button>
                        </Can>
                        <Can permission="productions.index.workday_close">
                            <Button type="button" variant="outline" onClick={close} disabled={!open}>
                                Cerrar jornada
                            </Button>
                        </Can>
                    </div>
                </div>
            </Card>
        );
    }

    const state = adminState;
    const workDate = state?.work_date;
    const open = state?.open ?? null;
    const closed = state?.closed ?? null;
    const longShift = state?.long_shift_warning;

    const startAdmin = () => {
        if (!adminEmployeeId) return;
        router.post(route('work-day-sessions.start'), { employee_id: Number(adminEmployeeId) }, { preserveScroll: true });
    };

    const closeAdmin = () => {
        if (!open?.id) return;
        router.post(route('work-day-sessions.close', open.id), {}, { preserveScroll: true });
    };

    return (
        <Card className="border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
            <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px] flex-1">
                        <Select
                            label="Empleado (salario diario)"
                            value={adminEmployeeId}
                            onChange={(e) => setAdminEmployeeId(e.target.value)}
                            options={selectableEmployees.map((e) => ({
                                value: e.id,
                                label: `${e.first_name} ${e.last_name}`,
                            }))}
                            placeholder="Seleccionar…"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Can permission="productions.index.workday_start">
                            <Button type="button" onClick={startAdmin} disabled={!adminEmployeeId || !!open || !!closed}>
                                Iniciar
                            </Button>
                        </Can>
                        <Can permission="productions.index.workday_close">
                            <Button type="button" variant="outline" onClick={closeAdmin} disabled={!open}>
                                Cerrar
                            </Button>
                        </Can>
                    </div>
                </div>
                {adminEmployeeId && state && workDate && (
                    <div className="flex items-start gap-2 text-sm text-indigo-900 dark:text-indigo-100">
                        <ClockIcon className="h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-xs text-indigo-800/90 dark:text-indigo-200/90">Fecha: {workDate}</p>
                            {open && <p>Entrada: {formatTime(open.clock_in_at)}</p>}
                            {closed && <p>Cerrada — {closed.duration_minutes ?? 0} min</p>}
                            {longShift && (
                                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                                    Jornada muy larga (&gt;12 h).
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {adminEmployeeId && !state && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">Sin datos de jornada para esta seleccion.</p>
                )}
            </div>
        </Card>
    );
}
