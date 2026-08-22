import type { ReactNode } from 'react';

interface Props {
    /** Ancla del indice lateral. */
    id?: string;
    /** Numero de la seccion; sin el no se pinta (la ficha de lectura no numera). */
    step?: number;
    title: string;
    /** «Obligatorio» / «Opcional», a la derecha del titulo. */
    requirement?: 'required' | 'optional';
    /** Lo que la seccion ya resolvio: la modalidad elegida, el banco, etc. */
    summary?: ReactNode;
    /**
     * En movil el encabezado lo pone la fila plegable de la pantalla de edicion; sin
     * esto el titulo saldria dos veces.
     */
    hideHeaderOnMobile?: boolean;
    children: ReactNode;
}

/**
 * Seccion del formulario de empleado.
 *
 * Sustituye a la tarjeta con cabecera: en lugar de encerrar los campos en una caja, los
 * separa con un encabezado y una regla que se desvanece en los extremos. Con cuatro
 * tarjetas apiladas el ojo cuenta bordes; asi cuenta secciones.
 */
export function EmployeeFormSection({
    id,
    step,
    title,
    requirement,
    summary,
    hideHeaderOnMobile = false,
    children,
}: Props) {
    return (
        <section id={id} className="scroll-mt-24">
            <div
                className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 ${hideHeaderOnMobile ? 'max-sm:hidden' : ''}`}
            >
                {step !== undefined ? (
                    <span
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]"
                        style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                    >
                        {step}
                    </span>
                ) : null}

                <h2 className="shrink-0 text-[15px]" style={{ color: 'var(--emp-text)' }}>
                    {title}
                </h2>

                {summary ? <span className="min-w-0 shrink-0">{summary}</span> : null}

                {requirement ? (
                    <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {requirement === 'required' ? 'Obligatorio' : 'Opcional'}
                    </span>
                ) : null}
            </div>

            <EmployeeFadingRule className={hideHeaderOnMobile ? 'max-sm:hidden' : ''} />

            <div className="mt-3.5">{children}</div>
        </section>
    );
}

/**
 * Regla que se desvanece en los dos extremos: separa sin cerrar una caja.
 */
export function EmployeeFadingRule({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={`mt-2.5 h-px ${className ?? ''}`}
            style={{
                background:
                    'linear-gradient(to right, transparent, var(--emp-border) 48px, var(--emp-border) calc(100% - 48px), transparent)',
            }}
        />
    );
}

export default EmployeeFormSection;
