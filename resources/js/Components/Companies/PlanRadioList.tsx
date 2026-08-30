import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export interface PlanOption {
    id: number;
    name: string;
    slug?: string | null;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly: number | string | null;
}

interface Props {
    plans: PlanOption[];
    /** Id del plan como cadena; `''` = sin plan. */
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    /** Texto de la opcion vacia; si se omite, no se ofrece. */
    emptyLabel?: string;
    error?: string;
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function limitText(limit: number | null): string {
    return limit == null ? 'ilimitados' : String(limit);
}

/**
 * Los planes como lista de radios en vez de `<select>`.
 *
 * Elegir plan es comparar precio y limites, y un desplegable los esconde justo cuando hacen
 * falta: obliga a abrirlo, leer una linea, cerrarlo y repetir. Aqui se ven los tres a la vez.
 */
export function PlanRadioList({ plans, value, onChange, disabled = false, emptyLabel, error }: Props) {
    const options: { key: string; name: string; detail: string; price: string | null }[] = [
        ...(emptyLabel ? [{ key: '', name: emptyLabel, detail: 'Sin límites asociados', price: null }] : []),
        ...plans.map((plan) => ({
            key: String(plan.id),
            name: plan.name,
            detail: `${limitText(plan.max_staff_users)} staff · ${limitText(plan.max_employees)} empleados`,
            price: plan.price_monthly == null ? null : `${money.format(Number(plan.price_monthly))} / mes`,
        })),
    ];

    return (
        <div>
            <div role="radiogroup" aria-label="Plan de membresía" className="space-y-2">
                {options.map((option) => {
                    const checked = option.key === value;

                    return (
                        <label
                            key={option.key || 'none'}
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                                'focus-within:ring-2 focus-within:ring-indigo-500',
                                checked
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40',
                                disabled && 'cursor-not-allowed opacity-60',
                            )}
                        >
                            <input
                                type="radio"
                                name="membership_plan_id"
                                value={option.key}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => onChange(option.key)}
                                className="sr-only"
                            />

                            <CheckCircleIcon
                                aria-hidden="true"
                                className={cn(
                                    'mt-0.5 h-5 w-5 shrink-0',
                                    checked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600',
                                )}
                            />

                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {option.name}
                                </span>
                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                    {option.detail}
                                </span>
                            </span>

                            {option.price ? (
                                <span className="shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                                    {option.price}
                                </span>
                            ) : null}
                        </label>
                    );
                })}
            </div>

            {error ? <p className="mt-1.5 text-xs text-rose-500">{error}</p> : null}
        </div>
    );
}

export default PlanRadioList;
