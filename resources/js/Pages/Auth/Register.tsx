import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRightIcon, BuildingOfficeIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { FormEvent, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import AuthLayout from '@/Layouts/AuthLayout';
import { cn } from '@/lib/utils';

export default function Register() {
    const [step, setStep] = useState<1 | 2>(1);
    const { data, setData, post, processing, errors } = useForm({
        company_name: '',
        company_nit: '',
        company_phone: '',
        name: '',
        last_name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const handleNext = (e: FormEvent) => {
        e.preventDefault();
        if (!data.company_name) return;
        setStep(2);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('register'));
    };

    return (
        <AuthLayout title="Registra tu empresa" description="Crea tu cuenta y empieza a gestionar tu taller.">
            <Head title="Registro" />

            {/* Stepper */}
            <div className="mb-6 flex items-center gap-2">
                {[1, 2].map((n) => (
                    <div key={n} className="flex flex-1 items-center gap-2">
                        <div
                            className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
                                step >= n
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                            )}
                        >
                            {n}
                        </div>
                        {n === 1 && (
                            <div
                                className={cn(
                                    'h-1 flex-1 rounded-full transition-colors',
                                    step >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700',
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <form onSubmit={handleNext} className="space-y-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <BuildingOfficeIcon className="h-5 w-5 text-indigo-600" />
                        Datos de la empresa
                    </div>

                    <Input
                        label="Nombre de la empresa"
                        value={data.company_name}
                        onChange={(e) => setData('company_name', e.target.value)}
                        error={errors.company_name}
                        placeholder="Mi Taller S.A.S."
                        required
                        autoFocus
                    />
                    <Input
                        label="NIT (opcional)"
                        value={data.company_nit}
                        onChange={(e) => setData('company_nit', e.target.value)}
                        error={errors.company_nit}
                        placeholder="900.123.456-7"
                    />
                    <Input
                        label="Telefono de contacto"
                        value={data.company_phone}
                        onChange={(e) => setData('company_phone', e.target.value)}
                        error={errors.company_phone}
                        placeholder="+57 311 234 5678"
                    />

                    <Button type="submit" fullWidth size="lg" icon={<ArrowRightIcon className="h-4 w-4" />} iconPosition="right">
                        Siguiente
                    </Button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={submit} className="space-y-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <UserCircleIcon className="h-5 w-5 text-indigo-600" />
                        Datos del administrador
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Nombre"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            required
                        />
                        <Input
                            label="Apellido"
                            value={data.last_name}
                            onChange={(e) => setData('last_name', e.target.value)}
                            error={errors.last_name}
                        />
                    </div>

                    <Input
                        label="Correo electronico"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={errors.email}
                        required
                    />

                    <Input
                        label="Contrasena"
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                        required
                    />

                    <Input
                        label="Confirmar contrasena"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        required
                    />

                    <div className="flex gap-3">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)} fullWidth>
                            Atras
                        </Button>
                        <Button type="submit" loading={processing} fullWidth size="lg">
                            Crear cuenta
                        </Button>
                    </div>
                </form>
            )}

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                Ya tienes cuenta?{' '}
                <Link href={route('login')} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    Inicia sesion
                </Link>
            </div>
        </AuthLayout>
    );
}
