import { Head, router } from '@inertiajs/react';
import { ArrowsClockwise, CaretLeft, CaretRight, Check } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { HolidayDetailCard } from '@/Components/Holidays/HolidayDetailCard';
import { HolidayList } from '@/Components/Holidays/HolidayList';
import { HolidayManualForm } from '@/Components/Holidays/HolidayManualForm';
import { HolidayYearCalendar } from '@/Components/Holidays/HolidayYearCalendar';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import AppLayout from '@/Layouts/AppLayout';
import { workdayHolidays, type HolidayRow } from '@/lib/holidays';
import { formatDateTime, formatNumber } from '@/lib/utils';
import '../../../css/module-ui.css';

interface Props {
    holidays: HolidayRow[];
    filters: { year: number };
    lastSyncedAt: string | null;
}

export default function HolidaysIndex({ holidays, filters, lastSyncedAt }: Props) {
    const [view, setView] = useState<'calendario' | 'lista'>('calendario');
    const [selected, setSelected] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<HolidayRow | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [justSynced, setJustSynced] = useState(false);

    const summary = useMemo(
        () => ({
            total: holidays.length,
            shifted: holidays.filter((holiday) => holiday.is_emiliani_shifted).length,
            manual: holidays.filter((holiday) => holiday.source === 'manual').length,
            workdays: workdayHolidays(holidays),
        }),
        [holidays],
    );

    const selectedHoliday = useMemo(
        () => holidays.find((holiday) => holiday.date === selected) ?? null,
        [holidays, selected],
    );

    const goToYear = (year: number) => {
        setSelected(null);
        router.get(route('holidays.index'), { year }, { preserveState: true, replace: true });
    };

    const sync = () => {
        setSyncing(true);
        router.post(
            route('holidays.sync'),
            { year: filters.year },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setJustSynced(true);
                    window.setTimeout(() => setJustSynced(false), 2500);
                },
                onFinish: () => setSyncing(false),
            },
        );
    };

    const legend = [
        { label: 'Festivo de ley', style: { backgroundColor: 'var(--emp-accent-fill)', border: '1px solid var(--emp-accent)' } },
        {
            label: 'Trasladado al lunes',
            style: {
                backgroundColor: 'var(--emp-accent-fill)',
                border: '1px solid var(--emp-accent)',
                boxShadow: 'inset 0 -2px 0 var(--emp-accent-line)',
            },
        },
        {
            label: 'Agregado a mano',
            style: { backgroundColor: 'var(--emp-accent-fill)', border: '1px dashed var(--emp-accent)' },
        },
    ];

    return (
        <AppLayout title="Festivos">
            <Head title="Festivos" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-10 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Festivos
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Calendario colombiano con la Ley Emiliani aplicada. De aquí sale el recargo dominical y
                            festivo de la nómina por horas.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            className="flex items-center rounded-[10px]"
                            style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                        >
                            <button
                                type="button"
                                onClick={() => goToYear(filters.year - 1)}
                                aria-label="Año anterior"
                                className="flex h-[34px] w-[34px] items-center justify-center"
                                style={{ color: 'var(--emp-muted)' }}
                            >
                                <CaretLeft size={14} />
                            </button>
                            <span
                                className="min-w-[60px] text-center text-[14px] tabular-nums"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                {filters.year}
                            </span>
                            <button
                                type="button"
                                onClick={() => goToYear(filters.year + 1)}
                                aria-label="Año siguiente"
                                className="flex h-[34px] w-[34px] items-center justify-center"
                                style={{ color: 'var(--emp-muted)' }}
                            >
                                <CaretRight size={14} />
                            </button>
                        </div>

                        <div className="emp-seg w-[190px]">
                            {(['calendario', 'lista'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setView(option)}
                                    className={`emp-seg-item ${view === option ? 'emp-seg-on' : ''}`}
                                >
                                    {option === 'calendario' ? 'Calendario' : 'Lista'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --------------------------------------------------- resumen */}
                <div className="emp-card mt-5 grid gap-3 p-[14px_17px] sm:grid-cols-4">
                    {[
                        { label: `Festivos ${filters.year}`, value: formatNumber(summary.total) },
                        { label: 'Trasladados (Emiliani)', value: formatNumber(summary.shifted) },
                        { label: 'Manuales', value: formatNumber(summary.manual) },
                        { label: 'Caen en jornada', value: formatNumber(summary.workdays) },
                    ].map((cell) => (
                        <div key={cell.label} className="min-w-0">
                            <p className="emp-kicker">{cell.label}</p>
                            <p className="mt-0.5 text-[18px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                {cell.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ------------------------------------------------- contenido */}
                <div className="mt-5 flex flex-col items-start gap-6 lg:flex-row lg:gap-[26px]">
                    <div className="w-full min-w-0 flex-1">
                        {/* Leyenda: el color no es lo unico que distingue los tres casos. */}
                        <div
                            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-2.5"
                            style={{ borderBottom: '1px solid var(--emp-border)' }}
                        >
                            {legend.map((item) => (
                                <span key={item.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    <span
                                        aria-hidden="true"
                                        className="rounded-[4px]"
                                        style={{ width: '20px', height: '16px', ...item.style }}
                                    />
                                    {item.label}
                                </span>
                            ))}
                        </div>

                        <div className="mt-4">
                            {view === 'calendario' ? (
                                <HolidayYearCalendar
                                    year={filters.year}
                                    holidays={holidays}
                                    selected={selected}
                                    onSelect={setSelected}
                                />
                            ) : (
                                <HolidayList
                                    holidays={holidays}
                                    selected={selected}
                                    onSelect={setSelected}
                                    onDelete={setConfirmDelete}
                                />
                            )}
                        </div>
                    </div>

                    {/* ------------------------------------------------ panel */}
                    <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-[84px] lg:w-[292px] lg:shrink-0 lg:self-start">
                        {selectedHoliday ? (
                            <HolidayDetailCard holiday={selectedHoliday} />
                        ) : (
                            <EmployeeAsideCard title="Día seleccionado">
                                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                    Toca un festivo en el calendario para ver de dónde viene y qué significa en la
                                    nómina.
                                </p>
                            </EmployeeAsideCard>
                        )}

                        <Can permission="holidays.index.sync">
                            <EmployeeAsideCard title="Sincronización">
                                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    {lastSyncedAt
                                        ? `Última sincronización: ${formatDateTime(lastSyncedAt)} · ${formatNumber(
                                              summary.total,
                                          )} festivos en ${filters.year}`
                                        : `Todavía no se ha sincronizado ${filters.year}.`}
                                </p>

                                <button
                                    type="button"
                                    onClick={sync}
                                    disabled={syncing}
                                    className="emp-btn emp-btn-primary mt-2.5 w-full"
                                >
                                    {justSynced ? <Check size={15} /> : <ArrowsClockwise size={15} />}
                                    {syncing
                                        ? 'Sincronizando…'
                                        : justSynced
                                          ? `Sincronizado ${filters.year}`
                                          : `Sincronizar ${filters.year}`}
                                </button>

                                <p className="emp-help">
                                    Recalcula los festivos de ley y aplica el traslado al lunes cuando la fecha no cae en
                                    lunes. Los festivos manuales no se tocan.
                                </p>
                            </EmployeeAsideCard>
                        </Can>

                        <Can permission="holidays.index.create">
                            <HolidayManualForm year={filters.year} />
                        </Can>
                    </aside>
                </div>
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('holidays.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar festivo"
                message={
                    confirmDelete
                        ? `Se elimina «${confirmDelete.name}». Solo se pueden eliminar los festivos agregados a mano; los de ley vuelven al sincronizar.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
