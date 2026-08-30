import { cn } from '@/lib/utils';

export interface Stat {
    label: string;
    value: string;
    note?: string;
    tone?: 'default' | 'warning';
}

interface Props {
    stats: Stat[];
    className?: string;
}

/**
 * Franja de metricas de cabecera.
 *
 * Un solo bloque con divisores en vez de tres o cuatro tarjetas sueltas: apiladas, el ojo
 * cuenta bordes antes que cifras, y en 1280 px las tarjetas separadas se parten en dos filas.
 */
export function StatBand({ stats, className }: Props) {
    if (stats.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'grid grid-cols-2 divide-slate-200 overflow-hidden rounded-xl border border-slate-200',
                'sm:grid-cols-4 sm:divide-x dark:divide-slate-700 dark:border-slate-700',
                stats.length === 2 && 'sm:grid-cols-2',
                stats.length === 3 && 'sm:grid-cols-3',
                className,
            )}
        >
            {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 px-4 py-3">
                    <p className="truncate text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        {stat.label}
                    </p>
                    <p
                        className={cn(
                            'mt-0.5 truncate text-2xl font-semibold tabular-nums',
                            stat.tone === 'warning'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-900 dark:text-slate-100',
                        )}
                    >
                        {stat.value}
                    </p>
                    {stat.note ? (
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={stat.note}>
                            {stat.note}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export default StatBand;
