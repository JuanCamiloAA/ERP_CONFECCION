import { Head, Link, useForm } from '@inertiajs/react';
import { Envelope } from '@phosphor-icons/react';
import { FormEvent } from 'react';
import { PublicButton, PublicField } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';

export default function ForgotPassword() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <AuthLayout
            title="Recuperar contraseña"
            description="Te enviaremos un enlace para restablecer tu contraseña."
            heading="Recupera el acceso a tu taller."
            subheading="Te llega un enlace al correo con el que entras al sistema."
        >
            <Head title="Recuperar contrasena" />

            <form onSubmit={submit} className="space-y-4">
                <PublicField
                    label="Correo electrónico"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    icon={<Envelope size={18} />}
                    placeholder="tucorreo@empresa.com"
                    required
                    autoFocus
                />

                <PublicButton type="submit" disabled={processing}>
                    {processing ? 'Enviando…' : 'Enviar enlace'}
                </PublicButton>
            </form>

            <p className="mt-6 text-sm">
                <Link href={route('login')} style={{ color: 'var(--pub-accent)' }}>
                    Volver al acceso
                </Link>
            </p>
        </AuthLayout>
    );
}
