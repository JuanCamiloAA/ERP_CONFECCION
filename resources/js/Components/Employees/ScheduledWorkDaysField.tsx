import { cn } from '@/lib/utils';

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
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Días hábiles esperados
            </label>
            <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                    const active = value.includes(day.iso);
                    return (
                        <button
                            key={day.iso}
                            type="button"
                            onClick={() => toggle(day.iso)}
                            className={cn(
                                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                                active
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300'
                                    : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400',
                            )}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Días en que se espera marcación de jornada; base para detectar inasistencias sin marcar.
            </p>
            {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
        </div>
    );
}

export default ScheduledWorkDaysField;
