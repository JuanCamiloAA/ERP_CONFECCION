import { nightSegments, nightSpanHours } from '@/lib/legalParameters';

const SCALE = ['00', '06', '12', '18', '24'];

/**
 * Barra de 24 horas con la franja nocturna pintada.
 *
 * Dos campos de hora no dejan ver que la franja cruza la medianoche ni cuantas horas
 * abarca; la barra lo dice de un vistazo.
 */
export function NightBandField({ start, end }: { start: string; end: string }) {
    const segments = nightSegments(start, end);
    const hours = nightSpanHours(start, end);
    const crossesMidnight = segments.length > 1;

    return (
        <div className="min-w-0">
            <div
                className="relative overflow-hidden rounded-[8px]"
                style={{ height: '34px', border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                role="img"
                aria-label={`Franja nocturna de ${start} a ${end}, ${hours} horas`}
            >
                {segments.map((segment, index) => (
                    <span
                        key={index}
                        className="absolute inset-y-0"
                        style={{
                            left: `${segment.left}%`,
                            width: `${segment.width}%`,
                            backgroundColor: 'var(--emp-accent-fill)',
                            borderLeft: '1px solid var(--emp-accent-line)',
                            borderRight: '1px solid var(--emp-accent-line)',
                        }}
                    />
                ))}
            </div>

            <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--emp-faint)' }}>
                {SCALE.map((mark) => (
                    <span key={mark}>{mark}</span>
                ))}
            </div>

            <p className="emp-help">
                {hours} {hours === 1 ? 'hora' : 'horas'} de franja nocturna
                {crossesMidnight ? ' (cruza la medianoche)' : ''}. Toda hora dentro de la franja lleva el recargo
                nocturno.
            </p>
        </div>
    );
}

export default NightBandField;
