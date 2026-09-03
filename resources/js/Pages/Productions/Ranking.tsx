import { Head, router } from '@inertiajs/react';
import { DownloadSimple, Medal, PushPin, TrendDown, TrendUp, X } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { RankingFilterBar, SHIFT_LABEL, type RankingFilterState } from '@/Components/Productions/RankingFilterBar';
import { Avatar } from '@/Components/UI/Avatar';
import { Can } from '@/Components/UI/Can';
import { EmpSwitch } from '@/Components/UI/ModuleFields';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { RANKING_PERMISSIONS } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/utils';
import type { EmployeeRankingRow } from '@/types';
import '../../../css/module-ui.css';

interface TeamFilter {
    date_start: string;
    date_end: string;
    set_by: string | null;
    updated_at: string | null;
}

interface Props {
    filters: {
        start: string;
        end: string;
        only_confirmed: boolean;
        reference_id: number | null;
        shift: string | null;
    };
    ranking: EmployeeRankingRow[];
    teamFilter: TeamFilter | null;
    defaultRange: { start: string; end: string };
    previousPeriod: { start: string; end: string };
    references: { id: number; code: string; name: string }[];
}

/**
 * Reparto del podio dentro de la paleta compartida.
 *
 * No hay oro, plata ni bronce porque no hay tokens para ellos y la hoja de estilos no se
 * amplia por una pantalla: los tres primeros se separan por cuanto acento llevan encima,
 * que ya es la gradacion que usa el resto de modulos.
 */
const PODIUM_TINT: Record<number, string> = {
    1: 'color-mix(in srgb, var(--emp-accent) 16%, transparent)',
    2: 'color-mix(in srgb, var(--emp-accent) 9%, transparent)',
    3: 'color-mix(in srgb, var(--emp-accent) 5%, transparent)',
};

const PODIUM_EDGE: Record<number, string> = {
    1: 'color-mix(in srgb, var(--emp-accent) 55%, transparent)',
    2: 'color-mix(in srgb, var(--emp-accent) 35%, transparent)',
    3: 'color-mix(in srgb, var(--emp-accent) 20%, transparent)',
};

export default function ProductionRanking({
    filters,
    ranking,
    teamFilter,
    defaultRange,
    previousPeriod,
    references,
}: Props) {
    const { can } = usePermissions();
    // Fuera de `<Can>` porque no condicionan un boton sino que pintan pantallas distintas:
    // sin filtro propio no hay barra que mostrar, y sin gestion de equipo el panel no debe
    // dejar ni el separador del interruptor.
    const canFilterOwn = can(RANKING_PERMISSIONS.ownFilter);
    const canManageTeam = can(RANKING_PERMISSIONS.teamFilter);

    const [local, setLocal] = useState<RankingFilterState>({
        start: filters.start,
        end: filters.end,
        reference_id: filters.reference_id ? String(filters.reference_id) : '',
        shift: filters.shift ?? '',
        only_confirmed: filters.only_confirmed,
    });

    /* ------------------------------------------------------------- navegacion */

    const queryFor = (state: RankingFilterState): Record<string, string> => {
        const params: Record<string, string> = { start: state.start, end: state.end };
        if (state.reference_id) params.reference_id = state.reference_id;
        if (state.shift) params.shift = state.shift;
        if (state.only_confirmed) params.only_confirmed = '1';

        return params;
    };

    const apply = (next: RankingFilterState) => {
        setLocal(next);
        router.get(route('productions.ranking'), queryFor(next), { preserveState: true, replace: true });
    };

    /** Vuelve al rango del equipo; si no hay ninguno, a la quincena en curso. */
    const resetToBase = () => {
        apply({
            start: teamFilter?.date_start ?? defaultRange.start,
            end: teamFilter?.date_end ?? defaultRange.end,
            reference_id: '',
            shift: '',
            only_confirmed: false,
        });
    };

    /* ---------------------------------------------------------- filtro equipo */

    // El interruptor esta encendido solo si lo que se ve coincide con lo fijado: si el
    // administrador se desvia para mirar otra cosa, no debe parecer que ya lo publico.
    const teamMatchesView =
        !! teamFilter && teamFilter.date_start === local.start && teamFilter.date_end === local.end;

    const toggleTeamFilter = (on: boolean) => {
        if (on) {
            router.post(
                route('productions.ranking.team-filter.store'),
                { date_start: local.start, date_end: local.end },
                { preserveScroll: true },
            );

            return;
        }

        router.delete(route('productions.ranking.team-filter.destroy'), { preserveScroll: true });
    };

    const viewMatchesTeam =
        !! teamFilter && teamFilter.date_start === filters.start && teamFilter.date_end === filters.end;

    /* -------------------------------------------------------------- derivados */

    const maxPoints = useMemo(() => Math.max(1, ...ranking.map((r) => r.total_points)), [ranking]);

    const totals = useMemo(() => {
        const points = ranking.reduce((s, r) => s + r.total_points, 0);
        const before = ranking.reduce((s, r) => s + r.previous_points, 0);

        return {
            employees: ranking.length,
            quantity: ranking.reduce((s, r) => s + r.total_quantity, 0),
            points,
            change: before === 0 ? null : Math.round(((points - before) / before) * 1000) / 10,
        };
    }, [ranking]);

    const exportUrl = useMemo(() => route('productions.ranking.export', queryFor(local)), [local]);

    // Del prop, no del estado local: esta linea describe lo que la lista de abajo esta
    // mostrando, y entre el clic y la respuesta el estado local va por delante.
    const activeReference = references.find((r) => r.id === filters.reference_id);

    /* ---------------------------------------------------------------- render */

    return (
        <AppLayout title="Ranking de producción">
            <Head title="Ranking de producción" />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-8 pt-5 sm:px-[34px]">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Ranking de producción
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Empleados ordenados por puntos: unidades ponderadas por el grado de dificultad de cada
                            operación.
                        </p>
                    </div>

                    <Can permission={RANKING_PERMISSIONS.export}>
                        <a href={exportUrl} className="emp-btn emp-btn-sm">
                            <DownloadSimple size={15} />
                            Exportar CSV
                        </a>
                    </Can>
                </div>

                {/* ------------------------------------------ banner de equipo */}
                {teamFilter ? (
                    <div className="emp-card mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 p-[13px]">
                        <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                        >
                            <PushPin size={14} weight="fill" />
                        </span>

                        <p className="min-w-0 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            Filtro del equipo: {formatDate(teamFilter.date_start)} al {formatDate(teamFilter.date_end)}
                            {teamFilter.set_by ? (
                                <span style={{ color: 'var(--emp-muted)' }}> · fijado por {teamFilter.set_by}</span>
                            ) : null}
                        </p>

                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {! viewMatchesTeam ? (
                                <button
                                    type="button"
                                    onClick={resetToBase}
                                    className="text-[12px] underline underline-offset-2"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                >
                                    Restablecer al filtro del equipo
                                </button>
                            ) : null}

                            <Can permission={RANKING_PERMISSIONS.teamFilter}>
                                <button
                                    type="button"
                                    onClick={() => toggleTeamFilter(false)}
                                    className="emp-btn emp-btn-sm emp-btn-ghost"
                                >
                                    <X size={13} />
                                    Quitar
                                </button>
                            </Can>
                        </div>
                    </div>
                ) : null}

                {/* -------------------------------------------------- metricas */}
                <Can permission={RANKING_PERMISSIONS.stats}>
                    <div className="mt-4 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
                        <Metric label="Empleados en el ranking" value={formatNumber(totals.employees)} />
                        <Metric label="Unidades totales" value={formatNumber(totals.quantity)} />
                        <Metric label="Puntos totales" value={formatNumber(totals.points)} />
                        <Metric
                            label="Variación vs. periodo anterior"
                            value={totals.change === null ? '—' : `${totals.change > 0 ? '+' : ''}${totals.change}%`}
                            hint={`${formatDate(previousPeriod.start)} – ${formatDate(previousPeriod.end)}`}
                            tone={totals.change === null ? 'plain' : totals.change >= 0 ? 'up' : 'down'}
                        />
                    </div>
                </Can>

                {/* --------------------------------------------------- filtros */}
                {canFilterOwn ? (
                    <div className="mt-4">
                        <RankingFilterBar
                            filters={local}
                            references={references}
                            onApply={apply}
                            onReset={resetToBase}
                            teamToggle={
                                canManageTeam ? (
                                    <EmpSwitch
                                        checked={teamMatchesView}
                                        onChange={toggleTeamFilter}
                                        label="Aplicar este filtro a todos los usuarios que abran el ranking"
                                        description="Solo las fechas. La referencia y el turno siguen siendo tuyos."
                                    />
                                ) : undefined
                            }
                        />
                    </div>
                ) : (
                    <>
                        <p className="emp-note mt-4">
                            El rango del ranking lo fija la administración de tu empresa. Estás viendo{' '}
                            {formatDate(filters.start)} al {formatDate(filters.end)}.
                        </p>

                        {/*
                          * Fijar el rango de todos no es «su» filtro, es el del equipo: quien
                          * tiene ese permiso lo conserva aunque no pueda desviarse para si mismo.
                          */}
                        {canManageTeam ? <TeamFilterForm start={filters.start} end={filters.end} /> : null}
                    </>
                )}

                {/* ------------------------------------------------- resumen del filtro */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    <span>
                        Del {formatDate(filters.start)} al {formatDate(filters.end)}
                    </span>
                    {activeReference ? <span>· Referencia {activeReference.code}</span> : null}
                    {filters.shift ? <span>· Turno {SHIFT_LABEL[filters.shift] ?? filters.shift}</span> : null}
                    {filters.only_confirmed ? <span>· Solo confirmadas</span> : null}
                </div>

                {/* ----------------------------------------------------- lista */}
                <div className="emp-card mt-3 overflow-hidden">
                    {ranking.length === 0 ? (
                        <div className="px-[17px] py-12 text-center">
                            <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                No hay producción registrada en este rango.
                            </p>
                            {canFilterOwn ? (
                                <button
                                    type="button"
                                    onClick={resetToBase}
                                    className="mt-1.5 text-[12px] underline underline-offset-2"
                                    style={{ color: 'var(--emp-accent-on)' }}
                                >
                                    Limpiar filtros
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <ul>
                            {ranking.map((row) => (
                                <RankingRow key={row.employee_id} row={row} maxPoints={maxPoints} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

/* --------------------------------------------------------------- auxiliares */

/**
 * Fijar el rango del equipo sin poder ajustar el propio.
 *
 * Es el caso de §2.3 del rediseno: el permiso de equipo no depende del personal, asi que
 * a quien solo tiene el primero se le da aqui lo unico que puede hacer —publicar un rango
 * para todos— en lugar de esconderselo dentro de un panel que no llega a ver.
 */
function TeamFilterForm({ start, end }: { start: string; end: string }) {
    const [dates, setDates] = useState({ start, end });

    const pin = () => {
        router.post(
            route('productions.ranking.team-filter.store'),
            { date_start: dates.start, date_end: dates.end },
            { preserveScroll: true },
        );
    };

    return (
        <div className="emp-card mt-3 p-[17px]">
            <p className="emp-kicker">Filtro del equipo</p>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                El rango que fijes aquí es el que verá todo el que abra el ranking.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="min-w-0">
                    <label className="emp-label" htmlFor="team-filter-start">
                        Desde
                    </label>
                    <input
                        id="team-filter-start"
                        type="date"
                        value={dates.start}
                        onChange={(e) => setDates({ ...dates, start: e.target.value })}
                        className="emp-field"
                    />
                </div>
                <div className="min-w-0">
                    <label className="emp-label" htmlFor="team-filter-end">
                        Hasta
                    </label>
                    <input
                        id="team-filter-end"
                        type="date"
                        value={dates.end}
                        onChange={(e) => setDates({ ...dates, end: e.target.value })}
                        className="emp-field"
                    />
                </div>
                <button
                    type="button"
                    onClick={pin}
                    disabled={! dates.start || ! dates.end || dates.start > dates.end}
                    className="emp-btn emp-btn-sm emp-btn-primary"
                >
                    <PushPin size={14} />
                    Fijar para todos
                </button>
            </div>
        </div>
    );
}

function RankingRow({ row, maxPoints }: { row: EmployeeRankingRow; maxPoints: number }) {
    const podium = row.position <= 3;
    const width = Math.max(3, Math.round((row.total_points / maxPoints) * 100));

    return (
        <li
            className="emp-row-sep emp-hover-row flex items-center gap-3 px-[17px] py-3 last:border-b-0 sm:gap-4"
            style={podium ? { backgroundColor: PODIUM_TINT[row.position] } : undefined}
        >
            {/* ---------------------------------------------------- posicion */}
            <div className="flex w-8 shrink-0 items-center justify-center sm:w-9">
                {podium ? (
                    <span
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                            color: 'var(--emp-accent-on)',
                            boxShadow: `inset 0 0 0 1px ${PODIUM_EDGE[row.position]}`,
                        }}
                        title={`Puesto ${row.position}`}
                    >
                        <Medal size={17} weight={row.position === 1 ? 'fill' : 'regular'} />
                    </span>
                ) : (
                    <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                        {row.position}
                    </span>
                )}
            </div>

            <Avatar name={row.employee?.full_name ?? 'Empleado'} src={row.employee?.photo} size="sm" zoomable />

            {/* -------------------------------------------------- nombre y barra */}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <p className="truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                        {row.employee?.full_name ?? `Empleado #${row.employee_id}`}
                    </p>
                    <ChangeTag value={row.change_percent} />
                </div>

                <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--emp-row)' }}
                    role="presentation"
                >
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: `${width}%`,
                            backgroundColor:
                                row.position === 1 ? 'var(--emp-accent)' : 'var(--emp-accent-line)',
                        }}
                    />
                </div>
            </div>

            {/* ------------------------------------------------------ cifras */}
            <div className="shrink-0 text-right">
                <p className="text-[16px] leading-tight tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    {formatNumber(row.total_points)}
                    <span className="ml-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        pts
                    </span>
                </p>
                <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    {formatNumber(row.total_quantity)} unidades
                </p>
            </div>
        </li>
    );
}

/** Variacion del empleado frente al periodo anterior; «nuevo» cuando antes no produjo. */
function ChangeTag({ value }: { value: number | null }) {
    if (value === null) {
        return <span className="emp-pill shrink-0">nuevo</span>;
    }

    if (value === 0) {
        return (
            <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                =
            </span>
        );
    }

    const up = value > 0;

    return (
        <span
            className="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums"
            style={{ color: up ? 'var(--emp-ok)' : 'var(--emp-danger)' }}
            title="Variación de puntos frente al periodo anterior"
        >
            {up ? <TrendUp size={11} /> : <TrendDown size={11} />}
            {up ? '+' : ''}
            {value}%
        </span>
    );
}

function Metric({
    label,
    value,
    hint,
    tone = 'plain',
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: 'plain' | 'up' | 'down';
}) {
    const color = tone === 'up' ? 'var(--emp-ok)' : tone === 'down' ? 'var(--emp-danger)' : 'var(--emp-text)';

    return (
        <div className="emp-card min-w-[150px] shrink-0 p-[17px] sm:min-w-0">
            <p className="emp-kicker">{label}</p>
            <p className="mt-1 text-[27px] leading-none tabular-nums" style={{ color }}>
                {value}
            </p>
            {hint ? (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
