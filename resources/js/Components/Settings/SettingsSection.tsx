import { CaretDown } from '@phosphor-icons/react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
    id: string;
    title: string;
    description?: ReactNode;
    /** Texto a la derecha del titulo (totales, avisos). */
    aside?: ReactNode;
    children: ReactNode;
}

/**
 * Una seccion de «Mi empresa».
 *
 * En `lg+` siempre esta abierta y el indice lateral la localiza por su `id`. Por debajo se
 * comporta como acordeon: cinco secciones desplegadas en un movil son una pagina de scroll
 * infinito donde no se encuentra nada.
 *
 * El `tabIndex={-1}` permite que el indice le de el foco al saltar, para que un lector de
 * pantalla anuncie donde ha llegado.
 */
export function SettingsSection({ id, title, description, aside, children }: Props) {
    const [open, setOpen] = useState(true);

    return (
        <section
            id={id}
            tabIndex={-1}
            aria-labelledby={`${id}-title`}
            className="emp-card scroll-mt-24 focus-visible:outline-none"
        >
            <div
                className="flex items-start justify-between gap-4 p-[17px]"
                style={{ borderBottom: '1px solid var(--emp-border)' }}
            >
                <button
                    type="button"
                    onClick={() => setOpen((v) => ! v)}
                    aria-expanded={open}
                    aria-controls={`${id}-body`}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left lg:pointer-events-none"
                >
                    <CaretDown
                        size={14}
                        aria-hidden="true"
                        className={cn('mt-1 shrink-0 transition-transform lg:hidden', ! open && '-rotate-90')}
                        style={{ color: 'var(--emp-subtle)' }}
                    />
                    <span className="min-w-0">
                        <span id={`${id}-title`} className="block text-[15px]" style={{ color: 'var(--emp-text)' }}>
                            {title}
                        </span>
                        {description ? (
                            <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                {description}
                            </span>
                        ) : null}
                    </span>
                </button>

                {aside ? <div className="shrink-0 text-right">{aside}</div> : null}
            </div>

            <div id={`${id}-body`} className={cn('p-[17px]', open ? 'block' : 'hidden', 'lg:block')}>
                {children}
            </div>
        </section>
    );
}

export default SettingsSection;
