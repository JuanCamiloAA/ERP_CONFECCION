import { useMemo } from 'react';
import { buildMonthGrid, WEEKDAY_INITIALS, type HolidayRow } from '@/lib/holidays';

interface Props {
    year: number;
    holidays: HolidayRow[];
    selected: string | null;
    onSelect: (iso: string) => void;
}

/**
 * El año en doce cuadriculas.
 *
 * Una tabla de 19 filas responde «que dias son festivos»; la pregunta real es «que
 * semanas tienen puente», y eso solo se ve en un calendario.
 */
export function HolidayYearCalendar({ year, holidays, selected, onSelect }: Props) {
    const months = useMemo(() => buildMonthGrid(year), [year]);
    const byDate = useMemo(
        () => new Map(holidays.map((holiday) => [holiday.date.slice(0, 10), holiday])),
        [holidays],
    );

    return (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
            {months.map((month) => {
                const count = month.cells.filter((cell) => cell.iso && byDate.has(cell.iso)).length;

                return (
                    <section key={month.month} className="emp-card p-3">
                        <header className="flex items-baseline justify-between gap-2">
                            <h3 className="text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                {month.label}
                            </h3>
                            <span className="text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                {count} {count === 1 ? 'festivo' : 'festivos'}
                            </span>
                        </header>

                        <div className="mt-2 grid grid-cols-7 gap-y-0.5">
                            {WEEKDAY_INITIALS.map((initial, index) => (
                                <span
                                    key={`${month.month}-h-${index}`}
                                    className="flex h-5 items-center justify-center text-[10px]"
                                    style={{ color: 'var(--emp-faint)' }}
                                >
                                    {initial}
                                </span>
                            ))}

                            {month.cells.map((cell, index) => {
                                if (!cell.iso) {
                                    return <span key={`${month.month}-e-${index}`} style={{ height: '26px' }} />;
                                }

                                const holiday = byDate.get(cell.iso);

                                if (!holiday) {
                                    return (
                                        <span
                                            key={cell.iso}
                                            className="flex items-center justify-center text-[11.5px] tabular-nums"
                                            style={{
                                                height: '26px',
                                                color: cell.isSunday ? 'var(--emp-faint)' : 'var(--emp-muted)',
                                            }}
                                        >
                                            {cell.day}
                                        </span>
                                    );
                                }

                                const isManual = holiday.source === 'manual';
                                const isSelected = selected === cell.iso;

                                return (
                                    <button
                                        key={cell.iso}
                                        type="button"
                                        onClick={() => onSelect(cell.iso as string)}
                                        title={
                                            holiday.original_date
                                                ? `${holiday.name} · trasladado desde el ${holiday.original_date}`
                                                : holiday.name
                                        }
                                        aria-pressed={isSelected}
                                        className="mx-auto flex items-center justify-center rounded-[6px] text-[11.5px] tabular-nums"
                                        style={{
                                            width: '26px',
                                            height: '26px',
                                            color: 'var(--emp-accent-on)',
                                            backgroundColor: 'var(--emp-accent-fill)',
                                            border: isManual ? '1px dashed var(--emp-accent)' : '1px solid var(--emp-accent)',
                                            // El trasladado lleva ademas un subrayado interno: en
                                            // blanco y negro sigue distinguiendose del resto.
                                            boxShadow: holiday.is_emiliani_shifted
                                                ? 'inset 0 -2px 0 var(--emp-accent-line)'
                                                : undefined,
                                            outline: isSelected ? '2px solid var(--emp-accent-line)' : undefined,
                                            outlineOffset: '1px',
                                        }}
                                    >
                                        {cell.day}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

export default HolidayYearCalendar;
