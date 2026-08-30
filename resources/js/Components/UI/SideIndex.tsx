import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SideIndexItem {
    id: string;
    label: string;
    meta?: string;
}

interface Props {
    items: SideIndexItem[];
    className?: string;
}

/**
 * Indice lateral pegajoso de un formulario largo.
 *
 * El activo lo decide un `IntersectionObserver` sobre las `<section id>`, no el clic: si se
 * marcara al pulsar, bajar con la rueda dejaria el indice mintiendo sobre donde estas.
 *
 * El desplazamiento es manual y no `scrollIntoView` porque la aplicacion tiene cabecera
 * fija: `scrollIntoView` deja el titulo de la seccion oculto debajo de ella.
 */
export function SideIndex({ items, className }: Props) {
    const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

    useEffect(() => {
        const sections = items
            .map((item) => document.getElementById(item.id))
            .filter((el): el is HTMLElement => el !== null);

        if (sections.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // La seccion activa es la mas alta de las visibles: al bajar, la que acabas
                // de dejar sigue intersecando un instante y robaria el foco del indice.
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length > 0) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
        );

        sections.forEach((section) => observer.observe(section));

        return () => observer.disconnect();
    }, [items]);

    const goTo = (id: string) => {
        const target = document.getElementById(id);
        if (! target) return;

        // 84 px = alto de la cabecera fija + un respiro.
        const top = target.getBoundingClientRect().top + window.scrollY - 84;
        window.scrollTo({ top, behavior: 'smooth' });
        target.focus({ preventScroll: true });
        setActiveId(id);
    };

    return (
        <nav aria-label="Secciones" className={cn('sticky top-6 hidden flex-col lg:flex', className)}>
            {items.map((item) => {
                const on = item.id === activeId;

                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => goTo(item.id)}
                        aria-current={on ? 'true' : undefined}
                        className={cn(
                            'border-l py-2 pl-3 text-left text-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                            on
                                ? 'border-indigo-500 font-medium text-slate-900 dark:text-slate-100'
                                : 'border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                        )}
                    >
                        <span className="block truncate">{item.label}</span>
                        {item.meta ? (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                                {item.meta}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </nav>
    );
}

export default SideIndex;
