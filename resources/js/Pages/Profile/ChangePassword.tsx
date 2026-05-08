import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, KeyIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import AppLayout from '@/Layouts/AppLayout';

export default function ChangePassword() {
    const page = usePage<App.PageProps>();
    const forceChange = !!page.props.auth.user?.password_change_required;

    const { data, setData, post, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
        force_change: forceChange ? 1 : 0,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('profile.change-password'), {
            onSuccess: () => reset('current_password', 'password', 'password_confirmation'),
        });
    };

    return (
        <AppLayout title="Cambiar contrasena">
            <Head title="Cambiar contrasena" />
            <div className="mx-auto max-w-2xl space-y-6">
                <PageHeader
                    title="Cambiar contrasena"
                    description="Actualiza la contrasena de acceso al sistema."
                    action={
                        !forceChange && (
                            <Link href={route('profile.edit')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Volver al perfil</Button>
                            </Link>
                        )
                    }
                />

                {forceChange && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300">
                        <ShieldExclamationIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-semibold">Debes cambiar tu contrasena</p>
                            <p>Por seguridad, antes de continuar debes establecer una contrasena nueva.</p>
                        </div>
                    </div>
                )}

                <Card>
                    <CardHeader
                        title="Nueva contrasena"
                        description="La contrasena debe tener al menos 8 caracteres."
                    />
                    <form onSubmit={submit} className="mt-4 space-y-4">
                        {!forceChange && (
                            <Input
                                type="password"
                                label="Contrasena actual"
                                value={data.current_password}
                                onChange={(e) => setData('current_password', e.target.value)}
                                error={errors.current_password}
                                required
                            />
                        )}
                        <Input
                            type="password"
                            label="Nueva contrasena"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            error={errors.password}
                            required
                        />
                        <Input
                            type="password"
                            label="Confirmar contrasena"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            required
                        />
                        <div className="flex justify-end">
                            <Button type="submit" loading={processing} icon={<KeyIcon className="h-4 w-4" />}>
                                Cambiar contrasena
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </AppLayout>
    );
}
