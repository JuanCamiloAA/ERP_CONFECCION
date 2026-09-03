import { DIFFICULTY_LABELS } from '@/lib/difficulty';

interface Props {
    /** Los cuatro topes; el quinto grado es «mas de» el ultimo. */
    thresholds: number[];
}

/**
 * Un tono por grado, del acento diluido al acento pleno.
 *
 * Sale de `--emp-accent` con `color-mix` y no de una escala propia: asi el degradado sigue
 * al tema —claro u oscuro— sin declarar dos juegos de color.
 */
const BAND_MIX = [22, 40, 60, 80, 100];

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
            <div className="flex h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--emp-row)' }}>
                {widths.map((width, index) => (
                    <div
                        key={index}
                        style={{
                            width: `${Math.min(100, width * 100)}%`,
                            backgroundColor: `color-mix(in srgb, var(--emp-accent) ${BAND_MIX[index]}%, transparent)`,
                        }}
                        title={`${index + 1} — ${DIFFICULTY_LABELS[index + 1]}`}
                    />
                ))}
            </div>

            <div
                className="mt-1.5 flex justify-between text-[10px] tabular-nums"
                style={{ color: 'var(--emp-subtle)' }}
            >
                <span>0 min</span>
                <span>más de {last} min</span>
            </div>
        </div>
    );
}

export default DifficultyScale;
