import { CheckIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { cn } from '@/lib/utils';

export interface PlanCardData {
    name: string;
    description?: string | null;
    is_featured?: boolean;
    slug: string;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly: number | string | null;
    features_json: string[] | null;
    is_active: boolean;
    trial_days?: number | null;
}

/** Precio del plan en un periodo de cobro, ya calculado por el servidor. */
export interface PlanCyclePrice {
    cycle: string;
    months: number;
    discount_percent: number;
    price: number | null;
}

interface Props {
    plan: PlanCardData;
    /** Lo que vale en cada periodo distinto del mensual. */
    cyclePrices?: PlanCyclePrice[];
    /** Borde indigo y sombra: el plan con mas empresas asignadas. */
    highlighted?: boolean;
    footer?: ReactNode;
    className?: string;
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function limit(value: number | null): string {
    return value == null ? 'Ilimitado' : String(value);
}

/**
 * La ficha de un plan tal y como se compara.
 *
 * La misma pieza sirve en el listado y como previsualizacion en vivo del formulario: si
 * fueran dos, lo que se ve al crear el plan dejaria de parecerse a lo que se ve despues.
 */
export function PlanCard({ plan, cyclePrices = [], highlighted = false, footer, className }: Props) {
    const features = plan.features_json ?? [];
    const longer = cyclePrices.filter((row) => row.months > 1 && row.price !== null);

    return (
        <article
            className={cn(
                'flex min-w-0 flex-col rounded-xl border bg-white p-5 dark:bg-slate-800',
                highlighted
                    ? 'border-indigo-500 shadow-md dark:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-700',
                className,
            )}
        >
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {plan.name || 'Sin nombre'}
                    </h3>
                    <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {plan.slug || 'sin-slug'}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={plan.is_active ? 'success' : 'danger'}>{plan.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    {plan.is_featured ? <Badge variant="primary">Destacado</Badge> : null}
                </div>
            </header>

            {plan.description ? (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
            ) : null}

            <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {plan.price_monthly == null || plan.price_monthly === ''
                        ? 'Sin precio'
                        : money.format(Number(plan.price_monthly))}
                </span>
                {plan.price_monthly != null && plan.price_monthly !== '' ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">/ mes</span>
                ) : null}
            </p>

            {plan.trial_days ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {plan.trial_days} {plan.trial_days === 1 ? 'día' : 'días'} de prueba
                </p>
            ) : null}

            {longer.length > 0 ? (
                <dl className="mt-3 space-y-1">
                    {longer.map((row) => (
                        <div key={row.cycle} className="flex items-baseline justify-between gap-2 text-xs">
                            <dt className="text-slate-500 dark:text-slate-400">
                                {row.cycle}
                                {row.discount_percent > 0 ? ` · −${row.discount_percent} %` : ''}
                            </dt>
                            <dd className="tabular-nums text-slate-700 dark:text-slate-200">{money.format(row.price ?? 0)}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Staff</p>
                    <p className="truncate text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {limit(plan.max_staff_users)}
                    </p>
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        Empleados
                    </p>
                    <p className="truncate text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {limit(plan.max_employees)}
                    </p>
                </div>
            </div>

            {features.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <CheckIcon
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                            />
                            <span className="min-w-0">{feature}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">Sin características listadas.</p>
            )}

            {footer ? (
                <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                    {footer}
                </footer>
            ) : null}
        </article>
    );
}

export default PlanCard;
