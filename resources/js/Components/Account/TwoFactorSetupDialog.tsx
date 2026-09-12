import { router } from '@inertiajs/react';
import { CheckCircle, Copy, DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmpInput } from '@/Components/UI/ModuleFields';
import { Modal } from '@/Components/UI/Modal';

export interface TwoFactorSetup {
    secret: string;
    /** SVG ya renderizado en el servidor: el secreto no pasa por un tercero. */
    qr: string;
    recovery_codes: string[];
}

/**
 * Alta de la verificación en dos pasos.
 *
 * Dos pasos visibles porque el backend también son dos: escanear y luego confirmar con un
 * código real. Hasta que la confirmación pasa, la cuenta sigue entrando solo con
 * contraseña —así un QR mal escaneado no deja a nadie fuera.
 *
 * Los códigos de respaldo se muestran una sola vez, aquí. No viajan en el payload de la
 * pantalla: son equivalentes a contraseñas.
 */
export function TwoFactorSetupDialog({
    open,
    setup,
    onClose,
}: {
    open: boolean;
    setup: TwoFactorSetup | null;
    onClose: () => void;
}) {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [processing, setProcessing] = useState(false);
    const [saved, setSaved] = useState(false);

    const confirm = () => {
        setProcessing(true);
        router.post(
            route('profile.two-factor.confirm'),
            { code },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCode('');
                    setError(undefined);
                    setSaved(false);
                    onClose();
                },
                onError: (errors) => setError(errors.code ?? 'No se pudo confirmar el código.'),
                onFinish: () => setProcessing(false),
            },
        );
    };

    if (!setup) {
        return null;
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Activar verificación en dos pasos"
            description="Escanea el código, guarda los de respaldo y confirma con un código de tu aplicación."
            size="lg"
            sheetOnMobile
            closeOnBackdrop={false}
            footer={
                <>
                    <button type="button" className="emp-btn emp-btn-ghost" onClick={onClose}>
                        Ahora no
                    </button>
                    <button
                        type="button"
                        className="emp-btn emp-btn-primary"
                        onClick={confirm}
                        disabled={processing || !saved}
                    >
                        {processing ? 'Confirmando…' : 'Confirmar y activar'}
                    </button>
                </>
            }
        >
            <div className="emp-scope space-y-4">
                {/* ---------------------------------------------------- paso 1: QR */}
                <section>
                    <p className="emp-kicker">Paso 1 · Escanea el código</p>
                    <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                        <div
                            className="shrink-0 rounded-lg bg-white p-2"
                            // El QR se genera en el servidor y no lleva nada del usuario salvo
                            // su correo y el secreto, que es justo lo que debe transportar.
                            dangerouslySetInnerHTML={{ __html: setup.qr }}
                            role="img"
                            aria-label="Código QR para la aplicación de autenticación"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Usa Google Authenticator, Microsoft Authenticator, 1Password o cualquier aplicación
                                compatible con TOTP.
                            </p>
                            <p className="mt-2 emp-kicker">O escribe esta clave a mano</p>
                            <div className="mt-1 flex items-center gap-2">
                                <code
                                    className="min-w-0 flex-1 break-all font-mono text-[12.5px]"
                                    style={{ color: 'var(--emp-text)' }}
                                >
                                    {setup.secret}
                                </code>
                                <button
                                    type="button"
                                    className="emp-btn emp-btn-sm shrink-0"
                                    onClick={() => copy(setup.secret, 'Clave copiada.')}
                                >
                                    <Copy size={14} aria-hidden="true" /> Copiar
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* -------------------------------------- paso 2: códigos de respaldo */}
                <section>
                    <p className="emp-kicker">Paso 2 · Guarda los códigos de respaldo</p>
                    <p className="mt-1 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                        Son tu única salida si pierdes el teléfono. Cada uno sirve una sola vez y no se vuelven a
                        mostrar.
                    </p>
                    <ul className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[12.5px] sm:grid-cols-4">
                        {setup.recovery_codes.map((item) => (
                            <li key={item} className="emp-strip rounded px-2 py-1 text-center" style={{ color: 'var(--emp-text)' }}>
                                {item}
                            </li>
                        ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="emp-btn emp-btn-sm"
                            onClick={() => copy(setup.recovery_codes.join('\n'), 'Códigos copiados.')}
                        >
                            <Copy size={14} aria-hidden="true" /> Copiar todos
                        </button>
                        <button
                            type="button"
                            className="emp-btn emp-btn-sm"
                            onClick={() => download(setup.recovery_codes)}
                        >
                            <DownloadSimple size={14} aria-hidden="true" /> Descargar
                        </button>
                    </div>

                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                        <input
                            type="checkbox"
                            checked={saved}
                            onChange={(event) => setSaved(event.target.checked)}
                            className="mt-0.5"
                        />
                        <span>Ya guardé mis códigos de respaldo en un lugar seguro.</span>
                    </label>
                </section>

                {/* --------------------------------------- paso 3: confirmar código */}
                <section>
                    <p className="emp-kicker">Paso 3 · Confirma</p>
                    <form
                        className="mt-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (saved) {
                                confirm();
                            }
                        }}
                    >
                        <EmpInput
                            label="Código de 6 dígitos"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            value={code}
                            onChange={(event) => {
                                setCode(event.target.value);
                                setError(undefined);
                            }}
                            error={error}
                            help="La verificación no queda activa hasta que este código sea correcto."
                        />
                        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                            Confirmar
                        </button>
                    </form>
                </section>
            </div>
        </Modal>
    );
}

/**
 * Copiar al portapapeles.
 *
 * `navigator.clipboard` no existe fuera de un contexto seguro (http sin TLS), que es
 * exactamente como se prueba esto en red local; por eso hay respaldo.
 */
function copy(text: string, message: string): void {
    const fallback = () => {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
            document.execCommand('copy');
            toast.success(message);
        } catch {
            toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
        }
        document.body.removeChild(area);
    };

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => toast.success(message), fallback);

        return;
    }

    fallback();
}

function download(codes: string[]): void {
    const blob = new Blob(
        [`Códigos de respaldo\n\nCada código sirve una sola vez.\n\n${codes.join('\n')}\n`],
        { type: 'text/plain;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codigos-de-respaldo.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/** Mismo diálogo reducido para cuando solo se regeneran los códigos. */
export function RecoveryCodesDialog({
    open,
    codes,
    onClose,
}: {
    open: boolean;
    codes: string[];
    onClose: () => void;
}) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Códigos de respaldo nuevos"
            description="Los anteriores dejaron de servir. Guarda estos ahora: no se vuelven a mostrar."
            size="md"
            sheetOnMobile
            footer={
                <button type="button" className="emp-btn emp-btn-primary" onClick={onClose}>
                    <CheckCircle size={15} aria-hidden="true" /> Ya los guardé
                </button>
            }
        >
            <div className="emp-scope">
                <ul className="grid grid-cols-2 gap-1.5 font-mono text-[12.5px] sm:grid-cols-4">
                    {codes.map((item) => (
                        <li key={item} className="emp-strip rounded px-2 py-1 text-center" style={{ color: 'var(--emp-text)' }}>
                            {item}
                        </li>
                    ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="emp-btn emp-btn-sm" onClick={() => copy(codes.join('\n'), 'Códigos copiados.')}>
                        <Copy size={14} aria-hidden="true" /> Copiar todos
                    </button>
                    <button type="button" className="emp-btn emp-btn-sm" onClick={() => download(codes)}>
                        <DownloadSimple size={14} aria-hidden="true" /> Descargar
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default TwoFactorSetupDialog;
