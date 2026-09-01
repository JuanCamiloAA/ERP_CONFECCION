import { Button } from '@/Components/UI/Button';
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
                'sticky bottom-[var(--tabbar-h)] z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur',
                'dark:border-slate-700 dark:bg-slate-800/90',
                className,
            )}
        >
            <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                {changes === 0
                    ? 'Sin cambios sin guardar'
                    : `${changes} ${changes === 1 ? 'cambio' : 'cambios'} sin guardar`}
            </p>

            <div className="flex shrink-0 items-center gap-2">
                {onCancel ? (
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={processing || changes === 0}>
                        Descartar
                    </Button>
                ) : null}
                <Button type="submit" loading={processing} disabled={changes === 0}>
                    {submitLabel}
                </Button>
            </div>
        </div>
    );
}

export default StickySaveBar;
