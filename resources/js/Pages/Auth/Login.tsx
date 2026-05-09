import { Head, Link, useForm } from '@inertiajs/react';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import AuthLayout from '@/Layouts/AuthLayout';

interface LoginProps {
    loginCompany?: { id: number; name: string; logo_url: string | null } | null;
}

export default function Login({ loginCompany = null }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const url =
            loginCompany?.id != null ? `${route('login')}?company=${loginCompany.id}` : route('login');
        post(url, {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Iniciar sesion" description="Ingresa tus credenciales para acceder al sistema.">
            <Head title="Iniciar sesion" />

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="Correo electronico"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    prefix={<EnvelopeIcon className="h-4 w-4" />}
                    placeholder="tucorreo@empresa.com"
                    required
                    autoFocus
                    autoComplete="email"
                />

                <Input
                    label="Contrasena"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    prefix={<LockClosedIcon className="h-4 w-4" />}
                    placeholder="********"
                    required
                    autoComplete="current-password"
                />

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Recordarme
                    </label>
                    <Link
                        href={route('password.request')}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                        Olvidaste tu contrasena?
                    </Link>
                </div>

                <Button type="submit" loading={processing} fullWidth size="lg">
                    Iniciar sesion
                </Button>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    <Link href={route('landing')} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                        Volver al sitio publico
                    </Link>
                </p>
            </form>
        </AuthLayout>
    );
}
