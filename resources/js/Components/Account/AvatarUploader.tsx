import { router } from '@inertiajs/react';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

/** Mismo límite que valida el servidor; duplicarlo aquí evita subir 5 MB para nada. */
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png'];

/**
 * Foto de la cuenta: círculo de 104px que acepta arrastrar y soltar.
 *
 * Sube al soltar, sin pasar por la barra de cambios sin guardar: es su propia ruta
 * (multipart) y mezclarla con el resto obligaría a enviar el formulario entero como
 * subida de archivo cada vez que se corrige un teléfono.
 *
 * El recorte cuadrado lo hace el CSS (`object-cover` sobre un contenedor circular): una
 * foto vertical se ve centrada y sin deformar, que es lo que se pedía, sin arrastrar una
 * librería de recorte a la pantalla.
 */
export function AvatarUploader({
    photoUrl,
    initials,
    name,
}: {
    photoUrl: string | null;
    initials: string;
    name: string;
}) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const upload = (file: File | null) => {
        if (!file) {
            return;
        }

        if (!ACCEPTED.includes(file.type)) {
            toast.error('La foto debe ser JPG o PNG.');

            return;
        }

        if (file.size > MAX_BYTES) {
            toast.error('La foto no puede pesar más de 2 MB.');

            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        setUploading(true);

        const body = new FormData();
        body.append('photo', file);

        router.post(route('profile.photo.update'), body, {
            forceFormData: true,
            preserveScroll: true,
            onError: (errors) => {
                toast.error(Object.values(errors)[0] ?? 'No se pudo subir la foto.');
                setPreview(null);
            },
            onFinish: () => {
                setUploading(false);
                // El servidor ya devolvió la URL definitiva; el objeto local sobra.
                URL.revokeObjectURL(objectUrl);
                setPreview(null);
            },
        });
    };

    const shown = preview ?? photoUrl;

    return (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    upload(event.dataTransfer.files?.[0] ?? null);
                }}
                className="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{
                    border: `1px ${dragging ? 'solid' : 'dashed'} ${dragging ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                    backgroundColor: dragging ? 'var(--emp-accent-tint)' : 'var(--emp-field-alt)',
                    opacity: uploading ? 0.6 : 1,
                }}
            >
                {shown ? (
                    <img src={shown} alt={name} className="h-full w-full object-cover" />
                ) : (
                    <span className="text-[26px]" style={{ color: 'var(--emp-subtle)' }} aria-hidden="true">
                        {initials}
                    </span>
                )}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    onChange={(event) => {
                        upload(event.target.files?.[0] ?? null);
                        // Permite volver a elegir el mismo archivo tras un error.
                        event.target.value = '';
                    }}
                />

                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    <button
                        type="button"
                        className="emp-btn emp-btn-sm"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                    >
                        <UploadSimple size={14} aria-hidden="true" />
                        {uploading ? 'Subiendo…' : photoUrl ? 'Cambiar foto' : 'Subir foto'}
                    </button>

                    {photoUrl ? (
                        <button
                            type="button"
                            className="emp-btn emp-btn-sm emp-btn-danger"
                            disabled={uploading}
                            onClick={() =>
                                router.delete(route('profile.photo.destroy'), { preserveScroll: true })
                            }
                        >
                            <Trash size={14} aria-hidden="true" /> Quitar
                        </button>
                    ) : null}
                </div>

                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    Arrastra la foto o sube un archivo · JPG o PNG, máx. 2 MB
                </p>
            </div>
        </div>
    );
}

export default AvatarUploader;
