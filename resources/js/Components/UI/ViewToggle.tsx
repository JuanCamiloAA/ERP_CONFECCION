import { Squares2X2Icon, TableCellsIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type ViewMode = 'table' | 'cards';

interface Props {
    value: ViewMode;
    onChange: (v: ViewMode) => void;
    className?: string;
    /**
     * `ui` usa las primitivas Tailwind (Empresas, Planes, Periodicidad); `emp` usa la piel
     * `emp-*` del resto de modulos. Un solo componente para que el control se comporte igual
     * en los dos sistemas de estilos que conviven en la aplicacion.
     */
    variant?: 'ui' | 'emp';
}

const OPTIONS: { v: ViewMode; label: string; Icon: typeof TableCellsIcon }[] = [
    { v: 'table', label: 'Tabla', Icon: TableCellsIcon },
    { v: 'cards', label: 'Tarjetas', Icon: Squares2X2Icon },
];

/**
 * Alterna entre la tabla densa (para operar) y las tarjetas (para leer de un vistazo).
 *
 * Vive en la barra de filtros y no en la cabecera: es un ajuste de la lista, no una accion
 * sobre el modulo, y ponerlo junto a «Nueva empresa» lo confundiria con una.
 */
export function ViewToggle({ value, onChange, className, variant = 'ui' }: Props) {
    if (variant === 'emp') {
        return (
            <div role="group" aria-label="Cambiar vista" className={cn('emp-seg shrink-0', className)}>
                {OPTIONS.map(({ v, label, Icon }) => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v)}
                        aria-pressed={value === v}
                        title={label}
                        className={cn(
                            'emp-seg-item inline-flex items-center justify-center gap-1.5',
                            value === v && 'emp-seg-on',
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="max-sm:hidden">{label}</span>
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div
            role="group"
            aria-label="Cambiar vista"
            className={cn(
                'inline-flex items-center gap-0.5 rounded-lg border border-slate-300 p-0.5 dark:border-slate-700',
                className,
            )}
        >
            {OPTIONS.map(({ v, label, Icon }) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    aria-pressed={value === v}
                    title={label}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                        value === v
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50',
                    )}
                >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
}

export default ViewToggle;
