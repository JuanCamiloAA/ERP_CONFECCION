import { router } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import { EmpInput } from '@/Components/UI/ModuleFields';
import { Modal } from '@/Components/UI/Modal';

type Method = 'post' | 'put' | 'patch' | 'delete';

/**
 * Diálogo que exige la contraseña actual antes de una acción sensible.
 *
 * Los cuatro caminos que cambian cómo se entra a la cuenta —correo, contraseña, 2FA y
 * cierre de sesiones— comparten este envoltorio en vez de repetir cada uno su campo de
 * reautenticación: con cuatro copias, la quinta acción que se añada acabaría sin él.
 *
 * El servidor vuelve a comprobar la contraseña en todos los casos; esto es la puerta, no
 * la cerradura.
 */
export function ReauthDialog({
    open,
    onClose,
    title,
    description,
    action,
    method = 'post',
    confirmLabel = 'Confirmar',
    /** Campos propios de la acción, además de la contraseña. */
    fields,
    /** Datos extra a enviar junto con `current_password`. */
    payload,
    /** Se limpia al abrir; sirve para reiniciar el estado del llamador. */
    onOpen,
    danger = false,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    action: string;
    method?: Method;
    confirmLabel?: string;
    fields?: (args: { errors: Record<string, string> }) => ReactNode;
    payload?: () => Record<string, unknown>;
    onOpen?: () => void;
    danger?: boolean;
}) {
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    // La contraseña nunca sobrevive al cierre del diálogo, ni siquiera en memoria.
    useEffect(() => {
        if (open) {
            setPassword('');
            setErrors({});
            onOpen?.();
        }
        // `onOpen` se omite a propósito: los llamadores la declaran en línea y volvería a
        // dispararse en cada render, reiniciando lo que el usuario está escribiendo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = () => {
        setProcessing(true);

        router[method](
            action,
            { current_password: password, ...(payload?.() ?? {}) } as never,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPassword('');
                    setErrors({});
                    onClose();
                },
                onError: (formErrors) => setErrors(formErrors as Record<string, string>),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            size="md"
            sheetOnMobile
            footer={
                <>
                    <button type="button" className="emp-btn emp-btn-ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`emp-btn ${danger ? 'emp-btn-danger' : 'emp-btn-primary'}`}
                        onClick={submit}
                        disabled={processing}
                    >
                        {processing ? 'Guardando…' : confirmLabel}
                    </button>
                </>
            }
        >
            {/* emp-scope: el modal se pinta en un portal, fuera del árbol de la página. */}
            <form
                className="emp-scope space-y-3.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {fields?.({ errors })}

                <EmpInput
                    label="Tu contraseña actual"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    error={errors.current_password}
                    help="La pedimos para confirmar que eres tú."
                />

                <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
                    {confirmLabel}
                </button>
            </form>
        </Modal>
    );
}

export default ReauthDialog;
