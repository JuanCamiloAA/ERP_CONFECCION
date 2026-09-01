import { useCallback, useEffect, useState } from 'react';

export type Density = 'compacta' | 'media' | 'amplia';
export type Chrome = 'panel' | 'seamless' | 'accent';

const DENSITY_KEY = 'erp.layout.density';
const CHROME_KEY = 'erp.layout.chrome';

const DENSITIES: Density[] = ['compacta', 'media', 'amplia'];
const CHROMES: Chrome[] = ['panel', 'seamless', 'accent'];

function read<T extends string>(key: string, valid: T[], fallback: T): T {
    if (typeof window === 'undefined') return fallback;

    try {
        const stored = window.localStorage.getItem(key) as T | null;
        if (stored && valid.includes(stored)) return stored;
    } catch {
        /* almacenamiento bloqueado */
    }

    return fallback;
}

/**
 * Densidad y tratamiento del marco, estampados como atributos en `<html>`.
 *
 * Van al elemento raíz y no a los componentes porque las medidas del marco son variables
 * CSS: así un solo atributo reajusta a la vez el sidebar, el navbar, la altura de fila y
 * los márgenes, sin que ningún componente tenga que enterarse.
 */
export function useLayoutChrome() {
    const [density, setDensityState] = useState<Density>(() => read(DENSITY_KEY, DENSITIES, 'media'));
    const [chrome, setChromeState] = useState<Chrome>(() => read(CHROME_KEY, CHROMES, 'panel'));

    useEffect(() => {
        document.documentElement.setAttribute('data-density', density);
    }, [density]);

    useEffect(() => {
        document.documentElement.setAttribute('data-chrome', chrome);
    }, [chrome]);

    const setDensity = useCallback((next: Density) => {
        setDensityState(next);
        try {
            window.localStorage.setItem(DENSITY_KEY, next);
        } catch {
            /* almacenamiento bloqueado */
        }
    }, []);

    const setChrome = useCallback((next: Chrome) => {
        setChromeState(next);
        try {
            window.localStorage.setItem(CHROME_KEY, next);
        } catch {
            /* almacenamiento bloqueado */
        }
    }, []);

    return { density, setDensity, chrome, setChrome };
}

export const DENSITY_LABELS: Record<Density, string> = {
    compacta: 'Compacta',
    media: 'Media',
    amplia: 'Amplia',
};

export const CHROME_LABELS: Record<Chrome, string> = {
    panel: 'Panel',
    seamless: 'Plano',
    accent: 'Acento',
};

export { DENSITIES, CHROMES };
