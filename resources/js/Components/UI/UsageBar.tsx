import { cn } from '@/lib/utils';

interface Props {
    used: number;
    /** `null` = plan sin tope. */
    limit: number | null;
    label?: string;
    className?: string;
}

/**
 * Cuanto se ha consumido de un limite del plan.
 *
 * Sustituye al texto gris «33 de 40 usuarios»: el color avisa antes de que alguien intente
 * crear el usuario 41 y se encuentre con el error. Ambar desde el 75 %, rojo desde el 90 %.
 */
export function UsageBar({ used, limit, label, className }: Props) {
    const unlimited = limit === null;
    const pct = unlimited || limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));

    const fill = unlimited
        ? 'bg-slate-300 dark:bg-slate-600'
        : pct >= 90
          ? 'bg-rose-500'
          : pct >= 75
            ? 'bg-amber-500'
            : 'bg-indigo-500';

    return (
        <div className={cn('min-w-0', className)}>
            <div className="flex items-baseline justify-between gap-2">
                {label ? (
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</span>
                ) : null}
                <span className="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                    {used} / {unlimited ? '∞' : limit}
                </span>
            </div>

            <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={unlimited ? undefined : limit}
                aria-label={label ?? 'Uso del plan'}
            >
                <span className={cn('block h-full rounded-full transition-all', fill)} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export default UsageBar;
