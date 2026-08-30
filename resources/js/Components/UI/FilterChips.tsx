import { cn } from '@/lib/utils';

export interface Chip {
    key: string;
    label: string;
    count?: number;
}

interface Props {
    chips: Chip[];
    active: string;
    onChange: (key: string) => void;
    className?: string;
    /** Etiqueta del grupo para lectores de pantalla. */
    label?: string;
    /** Solo lectura: se ven, no se pulsan. */
    disabled?: boolean;
}

/**
 * Filtros de una sola seleccion, visibles de golpe.
 *
 * Sustituye a los `<select>` de estado: con cuatro o cinco opciones, el desplegable esconde
 * el abanico y obliga a abrirlo para saber que hay. El conteo en cada chip evita ademas
 * pulsar un filtro que no devuelve nada.
 */
export function FilterChips({ chips, active, onChange, className, label = 'Filtros', disabled = false }: Props) {
    return (
        <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
            {chips.map((chip) => {
                const on = chip.key === active;

                return (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => onChange(chip.key)}
                        disabled={disabled}
                        aria-pressed={on}
                        className={cn(
                            'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                            on
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50',
                            disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent dark:hover:bg-transparent',
                        )}
                    >
                        {chip.label}
                        {chip.count !== undefined ? (
                            <span
                                className={cn(
                                    'tabular-nums',
                                    on ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500',
                                )}
                            >
                                {chip.count}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

export default FilterChips;
