import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { type DragEvent, useEffect, useState } from 'react';
import { BankLogo } from '@/Components/UI/BankLogo';
import { Button } from '@/Components/UI/Button';
import { cn } from '@/lib/utils';

interface Props {
    /** Nombre y monograma actuales, para la previsualización. */
    name: string;
    initials: string;
    brandColor: string | null;
    /** Logo ya guardado; se ignora si hay archivo nuevo o si se marcó quitar. */
    savedUrl: string | null;
    file: File | null;
    removed: boolean;
    onPick: (file: File | null) => void;
    onRemove: () => void;
    error?: string;
}

/**
 * Zona de carga del logo, con previsualización de cómo se verá en la ficha del empleado.
 *
 * La previsualización no es adorno: el logo se recorta con `object-contain` dentro de un
 * recuadro de 34px, y un archivo con mucho margen en blanco se ve diminuto ahí sin que se
 * note al mirar el archivo suelto.
 */
export function BankLogoField({
    name,
    initials,
    brandColor,
    savedUrl,
    file,
    removed,
    onPick,
    onRemove,
    error,
}: Props) {
    const [dragging, setDragging] = useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    // `createObjectURL` reserva memoria hasta que se revoca; sin el cleanup, elegir cinco
    // archivos seguidos deja cinco blobs vivos.
    useEffect(() => {
        if (! file) {
            setObjectUrl(null);

            return;
        }

        const url = URL.createObjectURL(file);
        setObjectUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    const previewUrl = objectUrl ?? (removed ? null : savedUrl);

    const takeFirstImage = (list: FileList | null) => {
        const picked = list?.[0] ?? null;
        if (picked) onPick(picked);
    };

    const onDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDragging(false);
        takeFirstImage(e.dataTransfer.files);
    };

    return (
        <div>
            <label
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                    'flex h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors',
                    'focus-within:ring-2 focus-within:ring-indigo-500',
                    dragging
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/40',
                )}
            >
                <input
                    type="file"
                    accept="image/png,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={(e) => takeFirstImage(e.target.files)}
                />

                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={`Logo de ${name || 'el banco'}`}
                        className="max-h-[86px] max-w-full object-contain"
                    />
                ) : (
                    <>
                        <ArrowUpTrayIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Arrastra el archivo del banco. PNG o SVG con fondo transparente, mínimo 128×128.
                        </p>
                    </>
                )}
            </label>

            {previewUrl ? (
                <div className="mt-2 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                        Quitar
                    </Button>
                </div>
            ) : null}

            {error ? <p className="mt-1.5 text-xs text-rose-500">{error}</p> : null}

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Previsualización
                </p>

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <BankLogo
                        name={name || 'Banco'}
                        initials={initials}
                        logoUrl={previewUrl}
                        brandColor={brandColor}
                        size={34}
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {name || 'Nombre del banco'}
                        </p>
                        <p className="truncate font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            Ahorros · ****4821
                        </p>
                    </div>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Así se ve en la ficha del empleado y en el desprendible de nómina.
                </p>
            </div>
        </div>
    );
}

export default BankLogoField;
