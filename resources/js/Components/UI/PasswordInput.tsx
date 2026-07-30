import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { forwardRef, useState } from 'react';
import { Input, InputProps } from '@/Components/UI/Input';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'suffix'> {
    /** Arranca en claro (util donde un administrador define o genera la contrasena). */
    defaultVisible?: boolean;
}

/** Campo de contrasena con boton para mostrarla u ocultarla. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ defaultVisible = false, disabled, ...props }, ref) => {
        const [visible, setVisible] = useState(defaultVisible);
        const actionLabel = visible ? 'Ocultar contrasena' : 'Mostrar contrasena';

        return (
            <Input
                {...props}
                ref={ref}
                disabled={disabled}
                type={visible ? 'text' : 'password'}
                suffix={
                    <button
                        type="button"
                        onClick={() => setVisible((current) => !current)}
                        disabled={disabled}
                        aria-label={actionLabel}
                        aria-pressed={visible}
                        title={actionLabel}
                        className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-500 dark:hover:text-slate-200"
                    >
                        {visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                }
            />
        );
    },
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
