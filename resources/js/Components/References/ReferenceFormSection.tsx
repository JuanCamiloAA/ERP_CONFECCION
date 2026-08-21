import type { ReactNode } from 'react';
import { ReferenceFadingRule } from '@/Components/References/ReferenceFormLayout';

interface Props {
    /** Numero del paso, dentro del circulo. Sin el no se pinta: la vista no tiene pasos. */
    step?: number;
    title: string;
    /** Resumen a la derecha del titulo: lo que la seccion ya resolvio. */
    summary?: ReactNode;
    /** Control opcional al final del encabezado (por ejemplo, «Crear operacion nueva»). */
    action?: ReactNode;
    children: ReactNode;
}

/**
 * Seccion del formulario.
 *
 * Sustituye a la tarjeta con cabecera: en vez de encerrar el contenido en una caja, lo
 * separa con un encabezado numerado y una regla que se desvanece. El resumen de la
 * derecha evita tener que bajar al panel para saber como va la seccion.
 */
export function ReferenceFormSection({ step, title, summary, action, children }: Props) {
    return (
        <section>
            {/*
              * Envuelve: en movil los controles de la seccion (recalcular, crear
              * operacion) no caben junto al titulo y desbordarian la pantalla.
              */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                {step !== undefined ? (
                    <span
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]"
                        style={{ backgroundColor: 'var(--ref-accent-soft)', color: 'var(--ref-accent-on)' }}
                    >
                        {step}
                    </span>
                ) : null}
                <h2 className="shrink-0 text-[14px]" style={{ color: 'var(--ref-text)' }}>
                    {title}
                </h2>
                {summary ? (
                    <span className="min-w-0 shrink truncate text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                        {summary}
                    </span>
                ) : null}
                <ReferenceFadingRule />
                {action ? <span className="ml-auto shrink-0">{action}</span> : null}
            </div>

            <div className="mt-3.5">{children}</div>
        </section>
    );
}
