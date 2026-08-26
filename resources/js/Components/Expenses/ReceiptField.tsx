import { Camera, FilePdf, FolderOpen, Image as ImageIcon, Paperclip } from '@phosphor-icons/react';
import { useRef, useState, type DragEvent } from 'react';
import { formatDate } from '@/lib/utils';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

/** Tamaño legible; el limite del servidor son 10 MB. */
function humanSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface ExistingReceipt {
    url: string | null;
    mime: string | null;
    name: string | null;
    uploadedAt: string | null;
}

interface Props {
    /** Archivo nuevo elegido en esta sesion; null si todavia no hay. */
    file: File | null;
    onChange: (file: File | null) => void;
    /** Comprobante ya guardado (solo al editar). */
    existing?: ExistingReceipt;
    error?: string;
}

/**
 * Zona de adjunto del comprobante.
 *
 * Reemplaza al `<input type="file">` con boton relleno: acepta arrastrar, ofrece la
 * camara del telefono como camino de primera clase y, al editar, muestra el archivo que
 * ya esta sin perderlo hasta que se guarde el reemplazo.
 */
export function ReceiptField({ file, onChange, existing, error }: Props) {
    const [dragging, setDragging] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);

    const hasExisting = Boolean(existing?.url) && !replacing && !file;

    const drop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);

        const dropped = event.dataTransfer.files?.[0];
        if (dropped) {
            onChange(dropped);
        }
    };

    const preview = (name: string, meta: string, isPdf: boolean, actions: React.ReactNode) => (
        <div
            className="flex items-center gap-3 rounded-[12px] p-3"
            style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
        >
            <span
                className="flex shrink-0 items-center justify-center rounded-[8px]"
                style={{ width: '44px', height: '52px', backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
            >
                {isPdf ? <FilePdf size={22} /> : <ImageIcon size={22} />}
            </span>

            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {name}
                </span>
                <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    {meta}
                </span>
            </span>

            <span className="flex shrink-0 items-center gap-1.5">{actions}</span>
        </div>
    );

    return (
        <div className="min-w-0">
            <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                    onChange(e.target.files?.[0] ?? null);
                    setReplacing(false);
                }}
            />
            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                    onChange(e.target.files?.[0] ?? null);
                    setReplacing(false);
                }}
            />

            {file
                ? preview(
                      file.name,
                      `${file.type.includes('pdf') ? 'PDF' : 'Imagen'} · ${humanSize(file.size)} · sin guardar todavía`,
                      file.type.includes('pdf'),
                      <>
                          <button type="button" onClick={() => onChange(null)} className="emp-btn emp-btn-sm">
                              Quitar
                          </button>
                          <button type="button" onClick={() => fileInput.current?.click()} className="emp-btn emp-btn-sm">
                              Cambiar
                          </button>
                      </>,
                  )
                : null}

            {hasExisting
                ? preview(
                      existing?.name ?? 'Comprobante',
                      `${existing?.mime?.includes('pdf') ? 'PDF' : 'Imagen'} · adjunto el ${formatDate(existing?.uploadedAt)}`,
                      Boolean(existing?.mime?.includes('pdf')),
                      <>
                          <a
                              href={existing?.url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="emp-btn emp-btn-sm"
                              style={{ textDecoration: 'none' }}
                          >
                              Ver
                          </a>
                          <button type="button" onClick={() => setReplacing(true)} className="emp-btn emp-btn-sm">
                              Reemplazar
                          </button>
                      </>,
                  )
                : null}

            {!file && !hasExisting ? (
                <>
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={drop}
                        onClick={() => fileInput.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInput.current?.click();
                            }
                        }}
                        className="flex cursor-pointer flex-col items-center justify-center rounded-[12px] text-center"
                        style={{
                            height: '132px',
                            border: `1px dashed ${dragging ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                            backgroundColor: dragging ? 'var(--emp-accent-tint)' : 'var(--emp-field-alt)',
                        }}
                    >
                        <Paperclip size={26} style={{ color: 'var(--emp-accent-line)' }} />
                        <p className="mt-2 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            Arrastra el archivo o toca para elegirlo
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            PDF, JPG, PNG o WEBP · máx. 10 MB
                        </p>
                    </div>

                    <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => cameraInput.current?.click()} className="emp-btn flex-1">
                            <Camera size={15} />
                            Tomar foto
                        </button>
                        <button type="button" onClick={() => fileInput.current?.click()} className="emp-btn flex-1">
                            <FolderOpen size={15} />
                            Elegir archivo
                        </button>
                    </div>

                    {replacing ? (
                        <button
                            type="button"
                            onClick={() => setReplacing(false)}
                            className="mt-2 text-[12px] underline underline-offset-2"
                            style={{ color: 'var(--emp-accent-on)' }}
                        >
                            Conservar el comprobante actual
                        </button>
                    ) : null}
                </>
            ) : null}

            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

export default ReceiptField;
