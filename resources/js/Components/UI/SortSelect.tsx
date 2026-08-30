import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface SortOption {
    key: string;
    label: string;
}

interface Props {
    options: SortOption[];
    value: string;
    direction: SortDirection;
    onChange: (key: string, direction: SortDirection) => void;
    className?: string;
    /** `emp` usa la piel `emp-*`; `ui`, las primitivas Tailwind. */
    variant?: 'ui' | 'emp';
}

/**
 * Criterio de orden de una lista, con su sentido.
 *
 * Va pegado al conmutador de vista porque son la misma clase de ajuste —cómo se presenta lo
 * que ya se filtró—, y separado de los chips, que sí cambian qué filas hay.
 *
 * El sentido es un botón aparte y no dos entradas del desplegable: cambiar de «Nombre» a
 * «Empleados» y luego invertir son dos decisiones distintas, y duplicar cada criterio
 * dejaría una lista del doble de largo para leer.
 */
export function SortSelect({ options, value, direction, onChange, className, variant = 'ui' }: Props) {
    const current = options.find((option) => option.key === value) ?? options[0];
    const flipped: SortDirection = direction === 'asc' ? 'desc' : 'asc';
    const Arrow = direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;

    if (variant === 'emp') {
        return (
            <div className={cn('flex shrink-0 items-center gap-1', className)}>
                <select
                    value={current?.key ?? ''}
                    onChange={(e) => onChange(e.target.value, direction)}
                    aria-label="Ordenar por"
                    className="emp-field h-8 w-[130px] py-0 text-[12px]"
                >
                    {options.map((option) => (
                        <option key={option.key} value={option.key}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => onChange(current?.key ?? value, flipped)}
                    aria-label={`Ordenar de forma ${flipped === 'asc' ? 'ascendente' : 'descendente'}`}
                    className="emp-btn emp-btn-sm emp-btn-ghost"
                >
                    <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
        );
    }

    return (
        <div className={cn('flex shrink-0 items-center gap-1', className)}>
            <select
                value={current?.key ?? ''}
                onChange={(e) => onChange(e.target.value, direction)}
                aria-label="Ordenar por"
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
                {options.map((option) => (
                    <option key={option.key} value={option.key}>
                        {option.label}
                    </option>
                ))}
            </select>

            <button
                type="button"
                onClick={() => onChange(current?.key ?? value, flipped)}
                aria-label={`Ordenar de forma ${flipped === 'asc' ? 'ascendente' : 'descendente'}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/50"
            >
                <Arrow className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

export default SortSelect;
