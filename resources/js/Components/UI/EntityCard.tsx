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
            className={cn('emp-card flex min-w-0 flex-col p-4', className)}
            // La elevacion es borde, no sombra: la tarjeta destacada engorda el trazo de
            // acento sobre el que ya trae `.emp-card`.
            style={
                highlighted
                    ? { boxShadow: '0 0 0 1px var(--emp-accent), inset 0 0 0 1px var(--emp-accent-fill)' }
                    : undefined
            }
        >
            <header className="flex items-start gap-3">
                {logo ?? (
                    <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                    >
                        {initials}
                    </span>
                )}

                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                        {title}
                    </div>
                    {subtitle ? (
                        <div className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            {subtitle}
                        </div>
                    ) : null}
                </div>

                {status ? <div className="shrink-0">{status}</div> : null}
            </header>

            {metrics.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="min-w-0">
                            <p className="emp-kicker truncate">{metric.label}</p>
                            <p
                                className="mt-0.5 truncate text-[19px] leading-none tabular-nums"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                {metric.value}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {usage ? <div className="mt-3">{usage}</div> : null}

            {children ? <div className="mt-3 min-w-0">{children}</div> : null}

            {tag || actions ? (
                <footer
                    className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3"
                    style={{ borderColor: 'var(--emp-border)' }}
                >
                    <div className="min-w-0 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        {tag}
                    </div>
                    {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
                </footer>
            ) : null}
        </article>
    );
}

export default EntityCard;
