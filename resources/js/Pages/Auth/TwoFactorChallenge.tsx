import { Head, router, useForm } from '@inertiajs/react';
import { ShieldCheck } from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import { PublicButton, PublicField } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';

/**
 * Segundo paso del inicio de sesión.
 *
 * Se llega con las credenciales ya validadas pero SIN sesión autenticada. El mismo campo
 * acepta el código del autenticador y uno de respaldo: obligar a elegir modo de antemano
 * solo añade un clic a alguien que ya perdió el teléfono.
 */
export default function TwoFactorChallenge({ recoveryCodesLeft }: { recoveryCodesLeft: number }) {
    const [usingRecovery, setUsingRecovery] = useState(false);
    const { data, setData, post, processing, errors } = useForm({ code: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('two-factor.challenge'));
    };

    return (
        <AuthLayout
            title="Verificación en dos pasos"
            description="Escribe el código de tu aplicación de autenticación."
            heading="Un paso más para entrar."
            subheading="Tu cuenta pide un código temporal además de la contraseña."
        >
            <Head title="Verificación en dos pasos" />

            <form onSubmit={submit} className="space-y-4">
                <PublicField
                    label={usingRecovery ? 'Código de respaldo' : 'Código de 6 dígitos'}
                    value={data.code}
                    onChange={(event) => setData('code', event.target.value)}
                    error={errors.code}
                    icon={<ShieldCheck size={18} />}
                    placeholder={usingRecovery ? 'XXXXX-XXXXX' : '000000'}
                    inputMode={usingRecovery ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                />

                <PublicButton type="submit" disabled={processing}>
                    {processing ? 'Verificando…' : 'Verificar y entrar'}
                </PublicButton>
            </form>

            <div className="mt-6 space-y-2 text-sm">
                <p>
                    <button
                        type="button"
                        className="underline underline-offset-2"
                        style={{ color: 'var(--pub-accent)' }}
                        onClick={() => {
                            setUsingRecovery((current) => !current);
                            setData('code', '');
                        }}
                    >
                        {usingRecovery
                            ? 'Usar el código de la aplicación'
                            : `Usar un código de respaldo${recoveryCodesLeft > 0 ? ` (${recoveryCodesLeft} disponibles)` : ''}`}
                    </button>
                </p>
                <p>
                    <button
                        type="button"
                        className="underline underline-offset-2 opacity-70"
                        onClick={() => router.delete(route('two-factor.challenge.cancel'))}
                    >
                        Cancelar y volver al inicio de sesión
                    </button>
                </p>
            </div>
        </AuthLayout>
    );
}
