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
                // El divisor sigue siendo `divide-x` y solo desde `sm`, como antes: apilado
                // en dos columnas, una linea vertical separaria bloques de filas distintas.
                'emp-card grid grid-cols-2 overflow-hidden sm:grid-cols-4',
                'sm:divide-x sm:divide-[color:var(--emp-border)]',
                stats.length === 2 && 'sm:grid-cols-2',
                stats.length === 3 && 'sm:grid-cols-3',
                className,
            )}
        >
            {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 px-4 py-3">
                    <p className="emp-kicker truncate">{stat.label}</p>
                    <p
                        className="mt-1 truncate text-[27px] leading-none tabular-nums"
                        style={{ color: stat.tone === 'warning' ? 'var(--emp-danger)' : 'var(--emp-text)' }}
                    >
                        {stat.value}
                    </p>
                    {stat.note ? (
                        <p
                            className="mt-1 truncate text-[12px]"
                            style={{ color: 'var(--emp-muted)' }}
                            title={stat.note}
                        >
                            {stat.note}
                        </p>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export default StatBand;
