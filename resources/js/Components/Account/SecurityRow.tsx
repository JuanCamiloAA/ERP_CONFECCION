import type { ReactNode } from 'react';

/**
 * Fila de estado de «Acceso y seguridad».
 *
 * El correo, la contraseña y la 2FA dejan de ser inputs sueltos: cada uno es un hecho con
 * su estado y su acción. La diferencia no es estética —un campo de texto editable en línea
 * sugiere que basta escribir encima, y ninguno de los tres cambia así: los tres exigen
 * reautenticación.
 */
export function SecurityRow({
    icon,
    label,
    value,
    tags,
    hint,
    actions,
}: {
    icon: ReactNode;
    label: string;
    value: ReactNode;
    tags?: ReactNode;
    hint?: ReactNode;
    actions: ReactNode;
}) {
    return (
        <div className="emp-row-sep flex flex-wrap items-start gap-x-3 gap-y-2.5 py-3.5 last:border-b-0">
            <span className="mt-0.5 shrink-0" style={{ color: 'var(--emp-muted)' }} aria-hidden="true">
                {icon}
            </span>

            <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
                <p className="emp-kicker">{label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                        {value}
                    </span>
                    {tags}
                </div>
                {hint ? (
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {hint}
                    </p>
                ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </div>
    );
}

export default SecurityRow;
