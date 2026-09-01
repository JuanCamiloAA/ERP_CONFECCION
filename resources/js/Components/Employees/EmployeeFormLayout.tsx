import { useEffect, useState, type ReactNode } from 'react';
import '../../../css/module-ui.css';

export interface EmployeeSectionRef {
    id: string;
    label: string;
}

/**
 * Secciones del formulario, en el orden en que se leen.
 *
 * Vive aqui —y no dentro de cada pagina— porque el indice lateral, el orden de las
 * secciones y la ficha de solo lectura tienen que contar la misma historia; ademas, una
 * constante de modulo mantiene la identidad del arreglo entre renders y evita que el
 * observador del indice se reinicie en cada pulsacion de tecla.
 */
export const EMPLOYEE_SECTIONS: EmployeeSectionRef[] = [
    { id: 'identidad', label: 'Identidad' },
    { id: 'contacto', label: 'Contacto' },
    { id: 'nomina', label: 'Nómina' },
    { id: 'pago', label: 'Datos para pago' },
    { id: 'acceso', label: 'Acceso al sistema' },
    { id: 'notas', label: 'Notas' },
];

interface Props {
    /** Cabecera propia del formulario; ocupa todo el ancho. */
    header: ReactNode;
    /** Secciones del formulario (columna central). */
    children: ReactNode;
    /** Panel derecho: columna fija en escritorio, bloque final en tableta y movil. */
    aside: ReactNode;
    /** Indice lateral; se oculta por debajo de 1024px. */
    nav?: ReactNode;
    /** Barra fija inferior de movil (pasos o acciones). */
    mobileBar?: ReactNode;
}

/**
 * Armazon de los formularios de empleado.
 *
 * Tres columnas en escritorio: indice, formulario y panel. Por debajo de 1024px el
 * indice desaparece —no hay ancho para el y el formulario cabe de una pasada— y el panel
 * baja al final del flujo. Por debajo de 640px la pagina toma el mando y presenta el
 * formulario por pasos; aqui solo queda la columna unica y el hueco para la barra fija.
 */
export function EmployeeFormLayout({ header, children, aside, nav, mobileBar }: Props) {
    return (
        <div className="emp-form emp-bleed min-h-screen">
            {header}

            {/*
              * Una sola columna que se abre en tres a partir de 1024px. El panel se
              * declara una vez y cambia de sitio con el orden del flex: pintarlo dos
              * veces (una para movil y otra para escritorio) duplicaria los anclas del
              * indice y `getElementById` devolveria siempre la copia equivocada.
              */}
            <div className="flex flex-col items-start gap-5 px-4 pb-32 pt-5 sm:px-[34px] sm:pb-[34px] sm:pt-6 lg:flex-row lg:gap-[26px]">
                {nav ? (
                    <nav className="sticky top-[84px] hidden w-[196px] shrink-0 self-start lg:block">{nav}</nav>
                ) : null}

                <div className="w-full min-w-0 flex-1">
                    <div className="flex flex-col gap-5">{children}</div>
                </div>

                <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-[84px] lg:w-[292px] lg:shrink-0 lg:self-start">
                    {aside}
                </aside>
            </div>

            {/* La barra fija es del modo por pasos, que solo existe por debajo de 640px. */}
            {mobileBar ? (
                <div
                    className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-40 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    {mobileBar}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Indice lateral con la seccion visible resaltada.
 *
 * El desplazamiento se calcula sobre la posicion en el documento en lugar de usar
 * `scrollIntoView`: este ultimo mueve el ancestro desplazable mas cercano y pelea con la
 * cabecera pegajosa, dejando el titulo de la seccion debajo de ella.
 */
export function EmployeeFormNav({ sections }: { sections: EmployeeSectionRef[] }) {
    const [active, setActive] = useState<string>(sections[0]?.id ?? '');

    useEffect(() => {
        const sync = () => {
            let current = sections[0]?.id ?? '';

            for (const section of sections) {
                const el = document.getElementById(section.id);
                if (el && el.getBoundingClientRect().top <= 120) {
                    current = section.id;
                }
            }

            setActive(current);
        };

        sync();
        window.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);

        return () => {
            window.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
        };
    }, [sections]);

    const goTo = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;

        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    };

    return (
        <ul className="flex flex-col gap-0.5">
            {sections.map((section) => (
                <li key={section.id}>
                    <button
                        type="button"
                        onClick={() => goTo(section.id)}
                        className={`emp-nav-item ${active === section.id ? 'emp-nav-on' : ''}`}
                        aria-current={active === section.id ? 'true' : undefined}
                    >
                        {section.label}
                    </button>
                </li>
            ))}
        </ul>
    );
}

/**
 * Tarjeta del panel derecho. Un solo sitio decide el relleno y el radio de las cuatro.
 */
export function EmployeeAsideCard({
    id,
    title,
    subtitle,
    action,
    children,
}: {
    id?: string;
    title?: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section id={id} className="emp-card p-[17px]">
            {title ? (
                <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            {title}
                        </h2>
                        {subtitle ? (
                            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    {action ? <div className="shrink-0">{action}</div> : null}
                </header>
            ) : null}

            {children}
        </section>
    );
}
