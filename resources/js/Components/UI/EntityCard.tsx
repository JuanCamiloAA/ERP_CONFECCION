import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EntityMetric {
    label: string;
    value: string;
}

interface Props {
    /** Iniciales o logo; si se pasa `logo`, sustituye a las iniciales. */
    initials?: string;
    logo?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    /** `Badge` de estado, a la derecha de la cabecera. */
    status?: ReactNode;
    metrics?: EntityMetric[];
    usage?: ReactNode;
    /** Etiqueta del pie a la izquierda (plan, vencimiento…). */
    tag?: ReactNode;
    actions?: ReactNode;
    highlighted?: boolean;
    children?: ReactNode;
    className?: string;
}

/**
 * Tarjeta generica de la vista «Tarjetas».
 *
 * Una sola forma para empresas, planes y periodicidades: si cada listado inventara la suya,
 * cambiar de modulo obligaria a reaprender donde esta el estado y donde el limite.
 */
export function EntityCard({
    initials,
    logo,
    title,
    subtitle,
    status,
    metrics = [],
    usage,
    tag,
    actions,
    highlighted = false,
    children,
    className,
}: Props) {
    return (
        <article
            className={cn(
                'flex min-w-0 flex-col rounded-xl border bg-white p-4 transition-shadow dark:bg-slate-800',
                highlighted
                    ? 'border-indigo-500 shadow-md dark:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-700',
                className,
            )}
        >
            <header className="flex items-start gap-3">
                {logo ?? (
                    <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    >
                        {initials}
                    </span>
                )}

                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div>
                    {subtitle ? (
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
                    ) : null}
                </div>

                {status ? <div className="shrink-0">{status}</div> : null}
            </header>

            {metrics.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="min-w-0">
                            <p className="truncate text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                                {metric.label}
                            </p>
                            <p className="truncate text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {metric.value}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {usage ? <div className="mt-3">{usage}</div> : null}

            {children ? <div className="mt-3 min-w-0">{children}</div> : null}

            {tag || actions ? (
                <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">{tag}</div>
                    {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
                </footer>
            ) : null}
        </article>
    );
}

export default EntityCard;
