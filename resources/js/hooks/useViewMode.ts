import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from '@/Components/UI/ViewToggle';

const KEY = (module: string) => `erp.viewMode.${module}`;

/**
 * Recuerda si el modulo se ve como tabla o como tarjetas.
 *
 * La preferencia es por modulo y no global: quien administra empresas quiere la comparativa
 * en tarjetas y las periodicidades en tabla densa, y una sola clave obligaria a cambiarla
 * cada vez. En movil arranca en tarjetas porque una tabla de seis columnas no se lee ahi.
 */
export function useViewMode(module: string, fallback: ViewMode = 'table') {
    const [mode, setMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return fallback;

        try {
            const saved = window.localStorage.getItem(KEY(module));
            if (saved === 'table' || saved === 'cards') return saved;
        } catch {
            // Navegador con almacenamiento bloqueado: se sigue con el valor por defecto.
        }

        return window.matchMedia('(max-width: 767px)').matches ? 'cards' : fallback;
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(KEY(module), mode);
        } catch {
            // Sin almacenamiento la eleccion dura lo que la pagina; no es motivo de error.
        }
    }, [module, mode]);

    return [mode, useCallback((v: ViewMode) => setMode(v), [])] as const;
}

export default useViewMode;
