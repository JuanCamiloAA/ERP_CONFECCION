import { Trash } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import { MONTH_NAMES, weekdayName, type HolidayRow } from '@/lib/holidays';
import { formatDate } from '@/lib/utils';

interface Props {
    holidays: HolidayRow[];
    selected: string | null;
    onSelect: (iso: string) => void;
    onDelete: (holiday: HolidayRow) => void;
}

/**
 * Los festivos del año en lista, agrupados por mes.
 *
 * Es la vista para buscar uno concreto; el calendario es la vista para leer el año.
 */
export function HolidayList({ holidays, selected, onSelect, onDelete }: Props) {
    const buckets = new Map<number, HolidayRow[]>();

    holidays.forEach((holiday) => {
        const month = Number(holiday.date.slice(5, 7)) - 1;
        buckets.set(month, [...(buckets.get(month) ?? []), holiday]);
    });

    if (holidays.length === 0) {
        return (
            <div className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                No hay festivos cargados para este año. Usa «Sincronizar» en el panel de la derecha.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[22px]">
            {[...buckets.entries()].map(([month, rows]) => (
                <section key={month}>
                    <header className="flex flex-wrap items-baseline gap-x-2 px-0.5 pb-2">
                        <h2 className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                            {MONTH_NAMES[month]}
                        </h2>
                        <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                            · {rows.length} {rows.length === 1 ? 'festivo' : 'festivos'}
                        </p>
                    </header>

                    {rows.map((holiday) => (
                        <div
                            key={holiday.id}
                            className={`emp-hover-row emp-row-sep flex items-center gap-2.5 px-2 py-2.5 ${
                                selected === holiday.date ? 'emp-seg-on' : ''
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onSelect(holiday.date)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                                <span className="w-[96px] shrink-0">
                                    <span className="block text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatDate(holiday.date)}
                                    </span>
                                    <span className="block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                        {weekdayName(holiday.date)}
                                    </span>
                                </span>

                                <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                    {holiday.name}
                                </span>

                                <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                                    {holiday.original_date ? (
                                        <span className="emp-pill">Trasladado desde {formatDate(holiday.original_date)}</span>
                                    ) : null}
                                    <span className={`emp-pill ${holiday.source === 'manual' ? 'emp-pill-accent' : ''}`}>
                                        {holiday.source === 'manual' ? 'Manual' : 'De ley'}
                                    </span>
                                </span>
                            </button>

                            {/* Solo los manuales se pueden borrar: los calculados vuelven al sincronizar. */}
                            {holiday.source === 'manual' ? (
                                <Can permission="holidays.index.delete">
                                    <button
                                        type="button"
                                        onClick={() => onDelete(holiday)}
                                        aria-label={`Eliminar ${holiday.name}`}
                                        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
                                        style={{ color: 'var(--emp-danger)' }}
                                    >
                                        <Trash size={15} />
                                    </button>
                                </Can>
                            ) : (
                                <span className="w-[30px] shrink-0" />
                            )}
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}

export default HolidayList;
