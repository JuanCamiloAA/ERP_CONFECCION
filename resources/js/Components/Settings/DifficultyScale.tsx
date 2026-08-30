import { DIFFICULTY_LABELS } from '@/lib/difficulty';
import { cn } from '@/lib/utils';

interface Props {
    /** Los cuatro topes; el quinto grado es «mas de» el ultimo. */
    thresholds: number[];
}

/** De claro a oscuro, un tono por grado. En dark se invierte el sentido del degradado. */
const BAND_TONES = [
    'bg-indigo-200 dark:bg-indigo-900',
    'bg-indigo-300 dark:bg-indigo-800',
    'bg-indigo-400 dark:bg-indigo-700',
    'bg-indigo-500 dark:bg-indigo-500',
    'bg-indigo-600 dark:bg-indigo-400',
];

/**
 * Barra escalonada de los cinco grados, proporcional a los umbrales.
 *
 * La lista de inputs sola no deja ver lo que de verdad importa: si un tramo se ha quedado
 * mucho mas ancho que los otros. Aqui se ve de un vistazo antes de guardar.
 */
export function DifficultyScale({ thresholds }: Props) {
    const last = thresholds[thresholds.length - 1] ?? 0;
    // El quinto tramo no tiene tope; se le da un cuarto del recorrido para que se vea.
    const total = last > 0 ? last * 1.25 : 1;

    const widths = thresholds.map((value, index) => {
        const from = index === 0 ? 0 : thresholds[index - 1];
        return Math.max(0, (value - from) / total);
    });
    widths.push(Math.max(0, (total - last) / total));

    return (
        <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                {widths.map((width, index) => (
                    <div
                        key={index}
                        className={cn(BAND_TONES[index])}
                        style={{ width: `${Math.min(100, width * 100)}%` }}
                        title={`${index + 1} — ${DIFFICULTY_LABELS[index + 1]}`}
                    />
                ))}
            </div>

            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                <span>0 min</span>
                <span>más de {last} min</span>
            </div>
        </div>
    );
}

export default DifficultyScale;
