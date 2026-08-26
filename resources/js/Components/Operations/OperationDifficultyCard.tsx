import { OperationAsideCard } from '@/Components/Operations/OperationFormLayout';
import { difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { formatNumber } from '@/lib/utils';

interface Props {
    /** Minutos escritos en el formulario; null mientras no haya un valor util. */
    minutes: number | null;
    /** Cortes de la empresa (Mi empresa > Dificultad por minutos). */
    thresholds: number[];
}

/**
 * Dificultad calculada a partir de los minutos.
 *
 * No es un campo: es el resultado de una regla, y por eso se muestra en el panel y no
 * entre los controles. La escala completa esta a la vista para que se entienda por que
 * salio ese grado y que hace falta para cambiarlo.
 *
 * La vista previa usa el mismo calculo que el backend (`levelFromMinutes` es el espejo de
 * `OperationDifficulty::levelFromMinutes`), pero quien decide al guardar es el servidor.
 */
export function OperationDifficultyCard({ minutes, thresholds }: Props) {
    const level = minutes !== null && minutes > 0 ? levelFromMinutes(minutes, thresholds) : null;

    /** Los cinco tramos, leidos de los cortes: hasta 3 · 3–7 · 7–15 · 15–25 · más de 25. */
    const ranges = [
        { level: 1, label: `hasta ${formatNumber(thresholds[0])} min` },
        { level: 2, label: `${formatNumber(thresholds[0])} – ${formatNumber(thresholds[1])} min` },
        { level: 3, label: `${formatNumber(thresholds[1])} – ${formatNumber(thresholds[2])} min` },
        { level: 4, label: `${formatNumber(thresholds[2])} – ${formatNumber(thresholds[3])} min` },
        { level: 5, label: `más de ${formatNumber(thresholds[3])} min` },
    ];

    return (
        <OperationAsideCard title="Dificultad calculada" subtitle="No se edita a mano: sale de los minutos">
            <p className="mt-2 text-[27px] leading-none" style={{ color: level ? 'var(--emp-accent-on)' : 'var(--emp-faint)' }}>
                {level ? difficultyLabel(level) : '—'}
            </p>
            <p className="mt-1 text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {level ? `Nivel ${level} de 5 · ${formatNumber(minutes ?? 0)} min` : 'Escribe los minutos'}
            </p>

            <div
                aria-hidden="true"
                className="my-3 h-px"
                style={{ backgroundColor: 'var(--emp-border)' }}
            />

            <ul className="flex flex-col gap-1">
                {ranges.map((range) => {
                    const on = range.level === level;

                    return (
                        <li key={range.level} className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                            <span style={{ color: on ? 'var(--emp-accent-on)' : 'var(--emp-subtle)' }}>
                                {range.level} · {difficultyLabel(range.level)}
                            </span>
                            <span style={{ color: on ? 'var(--emp-accent-on)' : 'var(--emp-faint)' }}>{range.label}</span>
                        </li>
                    );
                })}
            </ul>
        </OperationAsideCard>
    );
}

export default OperationDifficultyCard;
