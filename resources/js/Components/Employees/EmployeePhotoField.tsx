import { Camera } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';

interface Props {
    value: File | null;
    onChange: (file: File | null) => void;
    /** Foto ya guardada (editar); se muestra mientras no se elija otra. */
    currentUrl?: string | null;
    error?: string;
}

/**
 * Foto del empleado: recuadro de 96px que acepta arrastrar y soltar.
 *
 * Reemplaza al `<input type="file">` crudo, que en escritorio se leia como «Ningun
 * archivo seleccionado» —un mensaje del navegador, no del formulario— y no dejaba ver
 * lo que se acababa de elegir.
 */
export function EmployeePhotoField({ value, onChange, currentUrl, error }: Props) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    // La URL del objeto se libera al cambiar de archivo o al desmontar: sin esto cada
    // foto elegida deja un blob vivo en memoria hasta recargar la pagina.
    useEffect(() => {
        if (!value) {
            setPreview(null);

            return;
        }

        const url = URL.createObjectURL(value);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [value]);

    const take = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        // El navegador tambien deja soltar carpetas o PDF sobre la zona.
        if (!file.type.startsWith('image/')) return;

        onChange(file);
    };

    const shown = preview ?? currentUrl ?? null;

    return (
        <div>
            <span className="emp-label">Foto</span>

            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        take(e.dataTransfer.files);
                    }}
                    aria-label={shown ? 'Cambiar la foto del empleado' : 'Subir la foto del empleado'}
                    className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[14px] transition-colors"
                    style={{
                        border: `1px dashed ${dragging ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                        backgroundColor: dragging ? 'var(--emp-accent-fill)' : 'transparent',
                    }}
                >
                    {shown ? (
                        <img src={shown} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <Camera size={22} style={{ color: 'var(--emp-subtle)' }} />
                    )}
                </button>

                <div className="min-w-0 pt-1">
                    <p className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        Arrastra la foto o{' '}
                        <label
                            htmlFor={inputId}
                            className="cursor-pointer underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            sube un archivo
                        </label>
                        .
                    </p>
                    <p className="emp-help">JPG o PNG, hasta 2 MB.</p>
                    {value ? (
                        <button
                            type="button"
                            onClick={() => {
                                onChange(null);
                                if (inputRef.current) inputRef.current.value = '';
                            }}
                            className="mt-1.5 text-[11px] underline underline-offset-2"
                            style={{ color: 'var(--emp-muted)' }}
                        >
                            Quitar
                        </button>
                    ) : null}
                </div>
            </div>

            <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => take(e.target.files)}
            />

            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

export default EmployeePhotoField;
