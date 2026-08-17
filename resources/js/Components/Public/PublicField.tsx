import { Eye, EyeSlash } from '@phosphor-icons/react';
import { InputHTMLAttributes, ReactNode, useId, useState } from 'react';

interface PublicFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    label?: string;
    error?: string;
    /** Icono Phosphor a la izquierda del campo. */
    icon?: ReactNode;
}

/**
 * Campo de formulario con el lenguaje visual publico (oscuro + acento), para las pantallas
 * de acceso. No usa los componentes UI internos porque esos estan pensados para el tema
 * slate/indigo de la aplicacion y se verian fuera de lugar sobre el fondo oscuro.
 * Altura 52px en movil y 46px desde lg, como pide el diseno.
 */
export function PublicField({ label, error, icon, id, type = 'text', ...props }: PublicFieldProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const isPassword = type === 'password';
    const [reveal, setReveal] = useState(false);

    return (
        <div>
            {label ? (
                <label htmlFor={fieldId} className="mb-1.5 block text-sm" style={{ color: 'var(--pub-gray-1)' }}>
                    {label}
                </label>
            ) : null}
            <div className={`pub-field-shell h-13 lg:h-11.5 ${isPassword ? 'pl-3.5 pr-1.5' : 'px-3.5'}`}>
                {icon ? (
                    <span style={{ color: 'var(--pub-gray-4)' }} aria-hidden="true">
                        {icon}
                    </span>
                ) : null}
                <input
                    id={fieldId}
                    type={isPassword && reveal ? 'text' : type}
                    className="text-[15px]"
                    {...props}
                />
                {isPassword ? (
                    <button
                        type="button"
                        onClick={() => setReveal((v) => !v)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                        style={{ color: 'var(--pub-gray-3)' }}
                        aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        {reveal ? <EyeSlash size={18} /> : <Eye size={18} />}
                    </button>
                ) : null}
            </div>
            {error ? (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--pub-danger)' }}>
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/** Boton delineado del lenguaje publico. El contenedor controla si se muestra u oculta. */
export function PublicButton({
    children,
    quiet = false,
    className = '',
    ...props
}: InputHTMLAttributes<HTMLButtonElement> & { quiet?: boolean; children: ReactNode; type?: 'button' | 'submit' }) {
    return (
        <button {...props} className={`pub-btn ${quiet ? 'pub-btn-quiet' : ''} h-12 w-full text-[15px] ${className}`}>
            {children}
        </button>
    );
}

export default PublicField;
