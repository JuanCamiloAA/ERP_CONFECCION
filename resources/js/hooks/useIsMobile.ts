import { useEffect, useState } from 'react';

/**
 * true cuando el viewport es mas angosto que `breakpoint` (por defecto 1024px = `lg`).
 *
 * Se usa para las vistas que no pueden resolverse solo con clases CSS: el dashboard
 * cambia de grid arrastrable a lista con editor tactil, y los graficos necesitan una
 * altura numerica explicita (Recharts no acepta height="100%" sin contenedor medible).
 */
export function useIsMobile(breakpoint = 1024): boolean {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window === 'undefined' ? false : window.innerWidth < breakpoint,
    );

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', onResize);
        onResize();

        return () => window.removeEventListener('resize', onResize);
    }, [breakpoint]);

    return isMobile;
}

export default useIsMobile;
