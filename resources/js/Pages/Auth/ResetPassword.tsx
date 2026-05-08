import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
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
        <AuthLayout title="Nueva contrasena" description="Ingresa una nueva contrasena para tu cuenta.">
            <Head title="Nueva contrasena" />

            <form onSubmit={submit} className="space-y-4">
                <Input
                    label="Correo electronico"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    required
                />
                <Input
                    label="Nueva contrasena"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    required
                    autoFocus
                />
                <Input
                    label="Confirmar contrasena"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    required
                />

                <Button type="submit" loading={processing} fullWidth size="lg">
                    Restablecer contrasena
                </Button>
            </form>
        </AuthLayout>
    );
}
