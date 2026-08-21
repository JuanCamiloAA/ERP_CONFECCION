import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import '../../../css/reference-form.css';

interface Props {
    /** Encabezado propio del formulario; ocupa todo el ancho. */
    header: ReactNode;
    /** Secciones del formulario. */
    children: ReactNode;
    /** Panel de economia: columna fija en escritorio, barra inferior en movil. */
    aside: ReactNode;
    /** Barra fija de movil (resumen + acciones). */
    mobileBar?: ReactNode;
}

/**
 * Armazon de los formularios de referencia.
 *
 * Dos columnas en escritorio: el formulario crece y el panel de economia queda pegado
 * arriba, de modo que el margen unitario se ve sin desplazarse desde cualquier punto.
 * Por debajo de 640px pasa a una sola columna y el panel baja a una barra fija.
 *
 * El `padding-bottom` de movil reserva el alto de esa barra para que no tape el ultimo
 * campo del formulario.
 */
export function ReferenceFormLayout({ header, children, aside, mobileBar }: Props) {
    return (
        <div className="ref-form -m-4 min-h-screen sm:-m-6 lg:-m-8">
            {header}

            <div className="flex items-start">
                <div className="min-w-0 flex-1 px-4 pb-40 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
                    <div className="flex flex-col gap-7">{children}</div>
                </div>

                {/* Panel: solo desde 1024px, donde caben las dos columnas sin apretar. */}
                <aside
                    className="sticky top-0 hidden w-[316px] shrink-0 self-start lg:block"
                    style={{ borderLeft: '1px solid var(--ref-border)' }}
                >
                    {aside}
                </aside>
            </div>

            {mobileBar ? (
                <div
                    className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
                    style={{ backgroundColor: 'var(--ref-surface-head)', borderTop: '1px solid var(--ref-border)' }}
                >
                    {mobileBar}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Regla que se desvanece a la derecha del titulo de seccion. Separa sin dibujar una caja.
 */
export function ReferenceFadingRule({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('h-px min-w-4 flex-1', className)}
            style={{ background: 'linear-gradient(90deg, var(--ref-border), transparent)' }}
        />
    );
}
