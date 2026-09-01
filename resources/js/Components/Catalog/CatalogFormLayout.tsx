import type { ReactNode } from 'react';
import '../../../css/module-ui.css';

interface Props {
    header: ReactNode;
    children: ReactNode;
    aside: ReactNode;
    mobileBar?: ReactNode;
}

/**
 * Armazon de los formularios de catalogo (categorias de gasto y conceptos de nomina).
 *
 * Es `EmployeeFormLayout` sin indice lateral: con dos secciones, un indice que salta
 * entre «Identidad» y «Disponibilidad» ocupa mas de lo que ayuda.
 */
export function CatalogFormLayout({ header, children, aside, mobileBar }: Props) {
    return (
        <div className="emp-form emp-bleed min-h-screen">
            {header}

            <div className="flex flex-col items-start gap-5 px-4 pb-32 pt-5 sm:px-[34px] sm:pb-[34px] sm:pt-6 lg:flex-row lg:gap-[26px]">
                <div className="w-full min-w-0 flex-1">
                    <div className="flex flex-col gap-5">{children}</div>
                </div>

                <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-[84px] lg:w-[292px] lg:shrink-0 lg:self-start">
                    {aside}
                </aside>
            </div>

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

export default CatalogFormLayout;
