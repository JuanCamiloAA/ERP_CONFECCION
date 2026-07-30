import { ArrowPathIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useId } from 'react';
import { Button } from '@/Components/UI/Button';
import { Checkbox } from '@/Components/UI/Checkbox';
import { Input } from '@/Components/UI/Input';
import { cn, generatePassword } from '@/lib/utils';

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

export function AccessPasswordFields({ value, onChange, errors }: Props) {
    const modeGroupId = useId();
    const isManual = value.password_mode === 'manual';

    const selectMode = (mode: AccessPasswordMode) => {
        if (mode === value.password_mode) {
            return;
        }

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

    const modes: { key: AccessPasswordMode; label: string; hint: string }[] = [
        { key: 'auto', label: 'Autogenerar', hint: 'El sistema propone una contrasena segura' },
        { key: 'manual', label: 'Definir manualmente', hint: 'Usted digita la contrasena' },
    ];

    return (
        <div className="space-y-3">
            <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {modes.map((mode) => (
                        <label
                            key={mode.key}
                            className={cn(
                                'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                                value.password_mode === mode.key
                                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40'
                                    : 'border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                            )}
                        >
                            <input
                                type="radio"
                                name={`password-mode-${modeGroupId}`}
                                value={mode.key}
                                checked={value.password_mode === mode.key}
                                onChange={() => selectMode(mode.key)}
                                className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600"
                            />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                                    {mode.label}
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{mode.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {errors?.password_mode && <p className="mt-1.5 text-xs text-rose-500">{errors.password_mode}</p>}
            </div>

            {isManual ? (
                <div className="space-y-3">
                    <Input
                        type="text"
                        label="Contrasena"
                        value={value.user_password}
                        onChange={(e) => onChange({ user_password: e.target.value })}
                        error={errors?.user_password}
                        description="Minimo 8 caracteres, con mayusculas, minusculas, numeros y un caracter especial."
                        autoComplete="new-password"
                        required
                    />
                    <Input
                        type="text"
                        label="Confirmar contrasena"
                        value={value.user_password_confirmation}
                        onChange={(e) => onChange({ user_password_confirmation: e.target.value })}
                        error={errors?.user_password_confirmation}
                        autoComplete="new-password"
                        required
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            icon={<ArrowPathIcon className="h-4 w-4" />}
                            onClick={fillGeneratedPassword}
                        >
                            Generar sugerencia
                        </Button>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            La contrasena queda activa de inmediato. Compartala de forma segura con el empleado.
                        </span>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex gap-2">
                        <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm break-all text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            {value.user_password}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={fillGeneratedPassword}
                            aria-label="Regenerar contrasena"
                            icon={<ArrowPathIcon className="h-4 w-4" />}
                        />
                    </div>
                    <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <KeyIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Esta contrasena se mostrara una vez despues de guardar. Anotela antes de continuar.
                    </p>
                    {errors?.user_password && <p className="mt-1.5 text-xs text-rose-500">{errors.user_password}</p>}
                </div>
            )}

            <Checkbox
                checked={value.require_password_change}
                onChange={(e) => onChange({ require_password_change: e.target.checked })}
                label="Requerir cambio de contrasena en el primer inicio de sesion"
                description="El usuario debera establecer una nueva contrasena antes de acceder al sistema."
                error={errors?.require_password_change}
            />
        </div>
    );
}

export default AccessPasswordFields;
