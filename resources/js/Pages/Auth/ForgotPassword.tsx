import { Head, Link, useForm } from '@inertiajs/react';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
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
            title="Recuperar contrasena"
            description="Te enviaremos un enlace para restablecer tu contrasena."
        >
            <Head title="Recuperar contrasena" />

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="Correo electronico"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    prefix={<EnvelopeIcon className="h-4 w-4" />}
                    required
                    autoFocus
                />

                <Button type="submit" loading={processing} fullWidth size="lg">
                    Enviar enlace
                </Button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                <Link href={route('login')} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    Volver al login
                </Link>
            </div>
        </AuthLayout>
    );
}
