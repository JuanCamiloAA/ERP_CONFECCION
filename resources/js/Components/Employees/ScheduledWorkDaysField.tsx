interface ScheduledWorkDaysFieldProps {
    value: number[];
    onChange: (next: number[]) => void;
    error?: string;
}

const DAYS: { iso: number; label: string }[] = [
    { iso: 1, label: 'Lun' },
    { iso: 2, label: 'Mar' },
    { iso: 3, label: 'Mié' },
    { iso: 4, label: 'Jue' },
    { iso: 5, label: 'Vie' },
    { iso: 6, label: 'Sáb' },
    { iso: 7, label: 'Dom' },
];

/** Selector de dias habiles esperados (ISO 1=lunes..7=domingo); base para detectar inasistencias sin marcar. */
export function ScheduledWorkDaysField({ value, onChange, error }: ScheduledWorkDaysFieldProps) {
    const toggle = (iso: number) => {
        onChange(value.includes(iso) ? value.filter((d) => d !== iso) : [...value, iso].sort((a, b) => a - b));
    };

    return (
        <div className="w-full">
            <span className="emp-label">Días hábiles esperados</span>
            <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => {
                    const active = value.includes(day.iso);

                    return (
                        <button
                            key={day.iso}
                            type="button"
                            onClick={() => toggle(day.iso)}
                            aria-pressed={active}
                            className={`emp-day ${active ? 'emp-day-on' : ''}`}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
            <p className="emp-help">Días en que se espera marcación de jornada; base para detectar inasistencias.</p>
            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

export default ScheduledWorkDaysField;
