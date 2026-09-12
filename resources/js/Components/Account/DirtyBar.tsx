import { router } from '@inertiajs/react';
import { WarningCircle } from '@phosphor-icons/react';
import { useEffect } from 'react';

/**
 * Barra de cambios sin guardar.
 *
 * Solo existe cuando hay algo que guardar: un botón «Guardar» permanente enseña a
 * ignorarlo, y entonces deja de avisar el día que de verdad hay cambios pendientes.
 *
 * Además de pintarse, monta las dos redes de seguridad al salir: `beforeunload` para
 * recargar o cerrar la pestaña, y el interceptor de navegación de Inertia para los enlaces
 * internos —que no disparan `beforeunload` y son, de lejos, la forma más probable de
 * perder lo escrito.
 */
export function DirtyBar({
    dirty,
    processing,
    onDiscard,
    onSave,
}: {
    dirty: boolean;
    processing: boolean;
    onDiscard: () => void;
    onSave: () => void;
}) {
    useEffect(() => {
        if (!dirty) {
            return;
        }

        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // Los navegadores modernos ignoran el texto y muestran el suyo; asignar
            // `returnValue` sigue siendo lo que activa el aviso.
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', beforeUnload);

        const stopInertia = router.on('before', (event) => {
            // Guardar es una petición de Inertia también: no debe preguntarse a sí misma.
            const method = String(event.detail.visit.method ?? 'get').toLowerCase();
            if (method !== 'get') {
                return true;
            }

            return window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?');
        });

        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            stopInertia();
        };
    }, [dirty]);

    if (!dirty) {
        return null;
    }

    return (
        <div
            className="fixed inset-x-0 bottom-[var(--tabbar-h,0px)] z-40 border-t px-4 py-2.5 sm:px-[34px]"
            style={{
                borderColor: 'var(--emp-border)',
                // Translúcido con desenfoque: deja ver que hay contenido debajo sin
                // competir con él. El color sólido es el respaldo donde no hay blur.
                backgroundColor: 'color-mix(in srgb, var(--emp-bar) 88%, transparent)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
            role="region"
            aria-label="Cambios sin guardar"
        >
            <div className="mx-auto flex max-w-[920px] flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    <WarningCircle size={16} aria-hidden="true" style={{ color: 'var(--emp-accent-line)' }} />
                    Tienes cambios sin guardar
                </span>

                <div className="ml-auto flex items-center gap-2">
                    <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={onDiscard} disabled={processing}>
                        Descartar
                    </button>
                    <button type="button" className="emp-btn emp-btn-sm emp-btn-primary" onClick={onSave} disabled={processing}>
                        {processing ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DirtyBar;
