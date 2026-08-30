import type { ReactNode } from 'react';
import type { ViewMode } from '@/Components/UI/ViewToggle';
import { cn } from '@/lib/utils';

interface Props {
    view: ViewMode;
    table: ReactNode;
    cards: ReactNode;
    /** Contenedor de las tarjetas; por defecto una columna, como las listas `emp-*`. */
    cardsClassName?: string;
    /** Punto a partir del cual cabe la tabla. Por defecto `lg`. */
    breakpoint?: 'md' | 'lg';
}

/**
 * Decide que representacion de la lista se pinta.
 *
 * La regla no es «lo que el usuario eligio» a secas: por debajo del punto de corte siempre
 * se ven tarjetas, porque una tabla de siete columnas en un movil no se lee ni con scroll
 * horizontal. La eleccion del usuario manda de ese ancho en adelante, que es donde de
 * verdad hay una decision que tomar.
 *
 * Asi todas las listas se comportan igual, y las que ya tenian tabla en escritorio y
 * tarjetas en movil no cambian de aspecto para quien no toque el control.
 */
export function ListViewSwitch({ view, table, cards, cardsClassName, breakpoint = 'lg' }: Props) {
    const cardsWrapper = cn('flex flex-col gap-2', cardsClassName);

    if (view === 'cards') {
        return <div className={cardsWrapper}>{cards}</div>;
    }

    return (
        <>
            <div className={breakpoint === 'md' ? 'hidden md:block' : 'hidden lg:block'}>{table}</div>
            <div className={cn(cardsWrapper, breakpoint === 'md' ? 'md:hidden' : 'lg:hidden')}>{cards}</div>
        </>
    );
}

export default ListViewSwitch;

/**
 * La misma regla que `ListViewSwitch`, en forma de clase.
 *
 * Varias listas tienen la tabla y las tarjetas escritas en linea, con decenas de lineas de
 * JSX cada una. Extraerlas a props solo para envolverlas moveria codigo sin cambiar nada;
 * estas dos funciones aplican el mismo criterio tocando unicamente el contenedor.
 */
export function tableViewClass(view: ViewMode, extra = ''): string {
    return cn(view === 'cards' ? 'hidden' : 'hidden lg:block', extra);
}

export function cardsViewClass(view: ViewMode, extra = ''): string {
    return cn('flex flex-col gap-2', view === 'cards' ? '' : 'lg:hidden', extra);
}
