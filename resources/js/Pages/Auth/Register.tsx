import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Buildings, Envelope, LockKey, UserCircle } from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import { PublicButton, PublicField } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';

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

    const sectionTitle = (icon: React.ReactNode, text: string) => (
        <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--pub-gray-1)' }}>
            <span style={{ color: 'var(--pub-accent)' }}>{icon}</span>
            {text}
        </div>
    );

    return (
        <AuthLayout
            title="Registra tu empresa"
            description="Crea tu cuenta y empieza a gestionar tu taller."
            heading="Vincula tu taller en dos pasos."
            subheading="Creas la empresa, defines al administrador y empiezas a registrar producción."
        >
            <Head title="Registro" />

            {/* Progreso de los dos pasos: linea de acento, sin rellenos solidos. */}
            <div className="mb-6 flex items-center gap-2" aria-hidden="true">
                {[1, 2].map((n) => (
                    <div key={n} className="flex flex-1 items-center gap-2">
                        <span
                            className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                            style={{
                                border: `1px solid ${step >= n ? 'var(--pub-accent)' : 'var(--pub-gray-6)'}`,
                                color: step >= n ? 'var(--pub-accent-strong)' : 'var(--pub-gray-4)',
                            }}
                        >
                            {n}
                        </span>
                        {n === 1 ? (
                            <span
                                className="h-px flex-1"
                                style={{ backgroundColor: step >= 2 ? 'var(--pub-accent)' : 'var(--pub-gray-6)' }}
                            />
                        ) : null}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <form onSubmit={handleNext} className="space-y-4">
                    {sectionTitle(<Buildings size={18} />, 'Datos de la empresa')}

                    <PublicField
                        label="Nombre de la empresa"
                        value={data.company_name}
                        onChange={(e) => setData('company_name', e.target.value)}
                        error={errors.company_name}
                        placeholder="Mi Taller S.A.S."
                        required
                        autoFocus
                    />
                    <PublicField
                        label="NIT (opcional)"
                        value={data.company_nit}
                        onChange={(e) => setData('company_nit', e.target.value)}
                        error={errors.company_nit}
                        placeholder="900.123.456-7"
                    />
                    <PublicField
                        label="Teléfono de contacto"
                        value={data.company_phone}
                        onChange={(e) => setData('company_phone', e.target.value)}
                        error={errors.company_phone}
                        placeholder="+57 311 234 5678"
                    />

                    <PublicButton type="submit">
                        Siguiente
                        <ArrowRight size={18} />
                    </PublicButton>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={submit} className="space-y-4">
                    {sectionTitle(<UserCircle size={18} />, 'Datos del administrador')}

                    <div className="grid grid-cols-2 gap-3">
                        <PublicField
                            label="Nombre"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            required
                        />
                        <PublicField
                            label="Apellido"
                            value={data.last_name}
                            onChange={(e) => setData('last_name', e.target.value)}
                            error={errors.last_name}
                        />
                    </div>

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
                        label="Contraseña"
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                        icon={<LockKey size={18} />}
                        required
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

                    <div className="flex gap-3">
                        <PublicButton type="button" quiet onClick={() => setStep(1)}>
                            Atrás
                        </PublicButton>
                        <PublicButton type="submit" disabled={processing}>
                            {processing ? 'Creando…' : 'Crear cuenta'}
                        </PublicButton>
                    </div>
                </form>
            )}

            <p className="mt-6 text-sm" style={{ color: 'var(--pub-gray-3)' }}>
                ¿Ya tienes cuenta?{' '}
                <Link href={route('login')} style={{ color: 'var(--pub-accent)' }}>
                    Inicia sesión
                </Link>
            </p>
        </AuthLayout>
    );
}
