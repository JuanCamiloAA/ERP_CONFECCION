import { cn } from '@/lib/utils';

interface Props {
    /** Cuántos campos difieren de lo guardado; 0 desactiva el botón. */
    changes: number;
    processing?: boolean;
    onCancel?: () => void;
    submitLabel?: string;
    className?: string;
}

/**
 * Barra de guardado fija al pie de los formularios largos.
 *
 * En «Mi empresa» el botón vivía al final de una página de cinco secciones: había que bajar
 * hasta el fondo para saber si quedaba algo sin guardar. El contador responde eso sin
 * moverse del sitio donde se está editando.
 */
export function StickySaveBar({
    changes,
    processing = false,
    onCancel,
    submitLabel = 'Guardar cambios',
    className,
}: Props) {
    return (
        <div
            className={cn(
                'sticky bottom-[var(--tabbar-h)] z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 backdrop-blur',
                className,
            )}
            style={{
                // `color-mix` y no un alpha fijo: el desenfoque debe dejar ver la pagina
                // detras sin que la barra cambie de tono entre claro y oscuro.
                backgroundColor: 'color-mix(in srgb, var(--emp-bar) 92%, transparent)',
                borderTop: '1px solid var(--emp-border)',
            }}
        >
            <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }} aria-live="polite">
                {changes === 0
                    ? 'Sin cambios sin guardar'
                    : `${changes} ${changes === 1 ? 'cambio' : 'cambios'} sin guardar`}
            </p>

            <div className="flex shrink-0 items-center gap-2">
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={processing || changes === 0}
                        className="emp-btn emp-btn-sm emp-btn-ghost"
                    >
                        Descartar
                    </button>
                ) : null}
                <button type="submit" disabled={processing || changes === 0} className="emp-btn emp-btn-sm emp-btn-primary">
                    {processing ? 'Guardando…' : submitLabel}
                </button>
            </div>
        </div>
    );
}

export default StickySaveBar;
