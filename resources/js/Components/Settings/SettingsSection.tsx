import { ChevronDownIcon } from '@heroicons/react/24/outline';
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
            className="scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-sm focus-visible:outline-none dark:border-slate-700 dark:bg-slate-800"
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
                <button
                    type="button"
                    onClick={() => setOpen((v) => ! v)}
                    aria-expanded={open}
                    aria-controls={`${id}-body`}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:pointer-events-none"
                >
                    <ChevronDownIcon
                        aria-hidden="true"
                        className={cn(
                            'mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform lg:hidden',
                            ! open && '-rotate-90',
                        )}
                    />
                    <span className="min-w-0">
                        <span
                            id={`${id}-title`}
                            className="block text-base font-semibold text-slate-900 dark:text-slate-100"
                        >
                            {title}
                        </span>
                        {description ? (
                            <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
                                {description}
                            </span>
                        ) : null}
                    </span>
                </button>

                {aside ? <div className="shrink-0 text-right">{aside}</div> : null}
            </div>

            <div id={`${id}-body`} className={cn('p-5', open ? 'block' : 'hidden', 'lg:block')}>
                {children}
            </div>
        </section>
    );
}

export default SettingsSection;
