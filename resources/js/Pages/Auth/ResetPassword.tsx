import { Head, useForm } from '@inertiajs/react';
import { Envelope, LockKey } from '@phosphor-icons/react';
import { FormEvent } from 'react';
import { PublicButton, PublicField } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';

interface Props {
    email: string;
    token: string;
}

export default function ResetPassword({ email, token }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.store'));
    };

    return (
        <AuthLayout
            title="Nueva contraseña"
            description="Ingresa una nueva contraseña para tu cuenta."
            heading="Define tu nueva contraseña."
            subheading="Después de guardarla vuelves a entrar con normalidad."
        >
            <Head title="Nueva contrasena" />

            <form onSubmit={submit} className="space-y-4">
                <PublicField
                    label="Correo electrónico"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    icon={<Envelope size={18} />}
                    required
                />
                <PublicField
                    label="Nueva contraseña"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    icon={<LockKey size={18} />}
                    required
                    autoFocus
                    autoComplete="new-password"
                />
                <PublicField
                    label="Confirmar contraseña"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    icon={<LockKey size={18} />}
                    required
                    autoComplete="new-password"
                />

                <PublicButton type="submit" disabled={processing}>
                    {processing ? 'Guardando…' : 'Restablecer contraseña'}
                </PublicButton>
            </form>
        </AuthLayout>
    );
}
