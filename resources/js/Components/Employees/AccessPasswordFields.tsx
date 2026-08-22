import { ArrowsClockwise, Copy, Eye, EyeSlash, Key } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { generatePassword } from '@/lib/utils';

export type AccessPasswordMode = 'auto' | 'manual';

/** Campos que viajan al backend al crear la cuenta de acceso de un empleado. */
export interface AccessPasswordData {
    password_mode: AccessPasswordMode;
    user_password: string;
    user_password_confirmation: string;
    require_password_change: boolean;
}

export type AccessPasswordErrors = Partial<Record<keyof AccessPasswordData, string>>;

const GENERATED_LENGTH = 12;

const ACCESS_PASSWORD_KEYS: (keyof AccessPasswordData)[] = [
    'password_mode',
    'user_password',
    'user_password_confirmation',
    'require_password_change',
];

export function createAccessPasswordData(): AccessPasswordData {
    const generated = generatePassword(GENERATED_LENGTH);

    return {
        password_mode: 'auto',
        user_password: generated,
        user_password_confirmation: generated,
        require_password_change: true,
    };
}

/** Evita enviar datos de contrasena cuando no se va a crear la cuenta. */
export function stripAccessPasswordData<T extends AccessPasswordData>(data: T): Partial<T> {
    const payload: Partial<T> = { ...data };
    ACCESS_PASSWORD_KEYS.forEach((key) => delete payload[key as keyof T]);

    return payload;
}

interface Props {
    value: AccessPasswordData;
    onChange: (patch: Partial<AccessPasswordData>) => void;
    errors?: AccessPasswordErrors;
}

/** Campo de contrasena del panel: mismo alto y tokens que el resto del modulo. */
function SecretField({
    label,
    value,
    onChange,
    error,
    help,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    help?: string;
}) {
    const [visible, setVisible] = useState(true);

    return (
        <div>
            <span className="emp-label">
                {label} <span className="emp-req">*</span>
            </span>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete="new-password"
                    className={`emp-field pr-9 ${error ? 'emp-field-error' : ''}`}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded"
                    style={{ color: 'var(--emp-subtle)' }}
                >
                    {visible ? <EyeSlash size={15} /> : <Eye size={15} />}
                </button>
            </div>
            {help ? <p className="emp-help">{help}</p> : null}
            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

/**
 * Contrasena de la cuenta de acceso.
 *
 * La forma de elegirla es un segmentado de dos opciones —autogenerar o escribirla— y no
 * dos tarjetas de radio: es una decision binaria y no merece dos parrafos. El valor
 * generado se ve, se regenera y se copia sin salir del panel, porque despues de guardar
 * ya no vuelve a mostrarse.
 *
 * El contrato con el formulario no cambia: mismas claves, mismos errores.
 */
export function AccessPasswordFields({ value, onChange, errors }: Props) {
    const [generatedVisible, setGeneratedVisible] = useState(true);
    const isManual = value.password_mode === 'manual';

    const selectMode = (mode: AccessPasswordMode) => {
        if (mode === value.password_mode) return;

        if (mode === 'manual') {
            onChange({ password_mode: 'manual', user_password: '', user_password_confirmation: '' });

            return;
        }

        const generated = generatePassword(GENERATED_LENGTH);
        onChange({ password_mode: 'auto', user_password: generated, user_password_confirmation: generated });
    };

    const fillGeneratedPassword = () => {
        const generated = generatePassword(GENERATED_LENGTH);
        onChange({ user_password: generated, user_password_confirmation: generated });
    };

    // El portapapeles falla en contextos no seguros y si el usuario niega el permiso; en
    // ese caso hay que decirlo, porque esta contrasena no se vuelve a mostrar.
    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(value.user_password);
            toast.success('Contraseña copiada.');
        } catch {
            toast.error('No se pudo copiar. Selecciónela y cópiela a mano antes de guardar.');
        }
    };

    return (
        <div className="space-y-2.5">
            <div>
                <span className="emp-label">Contraseña</span>
                <div className="emp-seg" role="radiogroup" aria-label="Cómo definir la contraseña">
                    {(
                        [
                            { key: 'auto', label: 'Autogenerar' },
                            { key: 'manual', label: 'Definir manual' },
                        ] as { key: AccessPasswordMode; label: string }[]
                    ).map((mode) => (
                        <button
                            key={mode.key}
                            type="button"
                            role="radio"
                            aria-checked={value.password_mode === mode.key}
                            onClick={() => selectMode(mode.key)}
                            className={`emp-seg-item ${value.password_mode === mode.key ? 'emp-seg-on' : ''}`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
                {errors?.password_mode ? <p className="emp-error">{errors.password_mode}</p> : null}
            </div>

            {isManual ? (
                <div className="emp-reveal space-y-2.5">
                    <SecretField
                        label="Contraseña"
                        value={value.user_password}
                        onChange={(v) => onChange({ user_password: v })}
                        error={errors?.user_password}
                        help="Mínimo 8 caracteres, con mayúsculas, minúsculas, números y un carácter especial."
                    />
                    <SecretField
                        label="Confirmar contraseña"
                        value={value.user_password_confirmation}
                        onChange={(v) => onChange({ user_password_confirmation: v })}
                        error={errors?.user_password_confirmation}
                    />
                    <button type="button" onClick={fillGeneratedPassword} className="emp-btn emp-btn-sm w-full">
                        <ArrowsClockwise size={14} />
                        Generar sugerencia
                    </button>
                </div>
            ) : (
                <div className="emp-reveal">
                    <div className="flex gap-1.5">
                        <div
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5"
                            style={{
                                border: '1px solid var(--emp-border)',
                                backgroundColor: 'var(--emp-field-alt)',
                                minHeight: '38px',
                            }}
                        >
                            <span
                                className="min-w-0 flex-1 break-all font-mono text-[12.5px]"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                {generatedVisible ? value.user_password : '•'.repeat(value.user_password.length)}
                            </span>
                            <button
                                type="button"
                                onClick={() => setGeneratedVisible((v) => !v)}
                                aria-label={generatedVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                aria-pressed={generatedVisible}
                                className="shrink-0 rounded p-1"
                                style={{ color: 'var(--emp-subtle)' }}
                            >
                                {generatedVisible ? <EyeSlash size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={copyPassword}
                            aria-label="Copiar contraseña"
                            title="Copiar contraseña"
                            className="emp-btn emp-btn-sm shrink-0 px-2"
                        >
                            <Copy size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={fillGeneratedPassword}
                            aria-label="Regenerar contraseña"
                            title="Regenerar contraseña"
                            className="emp-btn emp-btn-sm shrink-0 px-2"
                        >
                            <ArrowsClockwise size={15} />
                        </button>
                    </div>

                    <p className="emp-note mt-2 flex items-start gap-1.5">
                        <Key size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--emp-accent-line)' }} />
                        <span>Se muestra una sola vez al guardar. Anótela o cópiela antes de continuar.</span>
                    </p>

                    {errors?.user_password ? <p className="emp-error">{errors.user_password}</p> : null}
                </div>
            )}

            <label className="flex cursor-pointer items-start gap-2 py-1.5">
                <input
                    type="checkbox"
                    checked={value.require_password_change}
                    onChange={(e) => onChange({ require_password_change: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded"
                    style={{ accentColor: 'var(--emp-accent)' }}
                />
                <span className="min-w-0 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    Pedir cambio de contraseña en el primer ingreso
                </span>
            </label>
            {errors?.require_password_change ? <p className="emp-error">{errors.require_password_change}</p> : null}
        </div>
    );
}

export default AccessPasswordFields;
