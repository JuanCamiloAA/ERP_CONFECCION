import { cn } from '@/lib/utils';

interface Props {
    name: string;
    /** Monograma de respaldo. El backend garantiza que nunca llega vacío. */
    initials: string;
    logoUrl?: string | null;
    brandColor?: string | null;
    size?: 30 | 34 | 44 | 72;
    className?: string;
}

const RADIUS: Record<number, string> = {
    30: 'rounded-[7px]',
    34: 'rounded-lg',
    44: 'rounded-[10px]',
    72: 'rounded-xl',
};

const FONT: Record<number, string> = {
    30: 'text-[10px]',
    34: 'text-[11px]',
    44: 'text-xs',
    72: 'text-lg',
};

/**
 * El logo de un banco, con monograma de respaldo.
 *
 * Una sola implementación para la tabla, las tarjetas, el selector del empleado y las
 * previsualizaciones: si cada pantalla resolviera el respaldo por su cuenta, en unas saldría
 * el monograma y en otras un recuadro vacío que parece un error de carga.
 *
 * Fondo blanco a propósito (en oscuro, `slate-900`): casi todos los logos bancarios son de
 * color sobre blanco y sobre un fondo oscuro se pierden.
 */
export function BankLogo({ name, initials, logoUrl, brandColor, size = 34, className }: Props) {
    return (
        <span
            style={{
                width: size,
                height: size,
                // El color de marca solo tiñe el borde cuando hay logo: sobre el monograma
                // competiría con el índigo del texto.
                borderColor: logoUrl && brandColor ? brandColor : undefined,
            }}
            className={cn(
                'inline-flex shrink-0 items-center justify-center overflow-hidden border bg-white font-semibold tracking-wide',
                'border-slate-200 dark:border-slate-700 dark:bg-slate-900',
                logoUrl ? '' : 'text-indigo-600 dark:text-indigo-300',
                RADIUS[size],
                FONT[size],
                className,
            )}
        >
            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt={`Logo de ${name}`}
                    loading="lazy"
                    // `object-contain` + relleno: un logo cuadrado y uno alargado se ven
                    // igual de bien sin recortarse.
                    className="h-full w-full object-contain p-1"
                />
            ) : (
                <span aria-hidden="true">{initials}</span>
            )}
        </span>
    );
}

export default BankLogo;
