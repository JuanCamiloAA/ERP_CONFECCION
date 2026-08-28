interface Props {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

/**
 * Interruptor de acceso de la cuenta.
 *
 * Es propio del módulo y no el `Switch` genérico porque ese trae sus propios colores; aquí
 * todo sale de las variables `--emp-*` para que se lea igual en claro y en oscuro.
 */
export function UserAccessSwitch({ checked, onChange, disabled = false }: Props) {
    return (
        <div
            className="flex items-center justify-between gap-3 rounded-[10px] p-3"
            style={{ border: '1px solid var(--emp-row)' }}
        >
            <div className="min-w-0">
                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    Puede iniciar sesión
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    Al apagarlo la cuenta queda bloqueada sin perder historial.
                </p>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label="Puede iniciar sesión"
                disabled={disabled}
                onClick={() => onChange(! checked)}
                className="relative shrink-0 rounded-full transition-colors disabled:opacity-50"
                style={{
                    width: '42px',
                    height: '24px',
                    backgroundColor: checked ? 'var(--emp-accent-fill)' : 'var(--emp-row)',
                    border: `1px solid ${checked ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                }}
            >
                <span
                    aria-hidden="true"
                    className="absolute top-1/2 block rounded-full transition-all"
                    style={{
                        width: '16px',
                        height: '16px',
                        transform: 'translateY(-50%)',
                        left: checked ? '22px' : '3px',
                        backgroundColor: checked ? 'var(--emp-accent-line)' : 'var(--emp-subtle)',
                    }}
                />
            </button>
        </div>
    );
}

export default UserAccessSwitch;
