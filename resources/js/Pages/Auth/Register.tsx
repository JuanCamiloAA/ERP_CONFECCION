import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Buildings, Check, CreditCard, Envelope, LockKey, UserCircle } from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import { PublicButton, PublicField } from '@/Components/Public/PublicField';
import AuthLayout from '@/Layouts/AuthLayout';
import { formatCurrency } from '@/lib/utils';

interface Plan {
    id: number;
    name: string;
    slug: string;
    price_monthly: number | null;
    max_staff_users: number | null;
    max_employees: number | null;
    features: string[];
}

interface Props {
    plans: Plan[];
    /** Falso si el super admin no ha cargado las llaves de la pasarela. */
    paymentsEnabled: boolean;
}

type Step = 1 | 2 | 3;

export default function Register({ plans, paymentsEnabled }: Props) {
    const [step, setStep] = useState<Step>(1);

    const { data, setData, post, processing, errors } = useForm({
        membership_plan_id: '' as string | number,
        company_name: '',
        company_nit: '',
        company_phone: '',
        company_email: '',
        name: '',
        last_name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const selected = plans.find((plan) => String(plan.id) === String(data.membership_plan_id)) ?? null;

    const pickPlan = (plan: Plan) => {
        setData('membership_plan_id', plan.id);
        setStep(2);
    };

    const goToPayment = (e: FormEvent) => {
        e.preventDefault();
        if (! data.company_name) return;
        setStep(3);
    };

    // `post` sale del dominio: el controlador responde con una redirección dura al
    // checkout de Wompi, así que esta página no vuelve a renderizarse si todo va bien.
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

    const limit = (value: number | null) => (value === null ? 'Ilimitados' : String(value));

    return (
        <AuthLayout
            title="Registra tu empresa"
            description="Elige tu plan, crea tu cuenta y paga el primer mes."
            heading="Vincula tu taller en tres pasos."
            subheading="Eliges el plan, defines al administrador y pagas el primer mes. La cuenta queda activa al instante."
        >
            <Head title="Registro" />

            {/* Progreso: linea de acento, sin rellenos solidos. */}
            <div className="mb-6 flex items-center gap-2" aria-hidden="true">
                {([1, 2, 3] as Step[]).map((n) => (
                    <div key={n} className="flex flex-1 items-center gap-2">
                        <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                            style={{
                                border: `1px solid ${step >= n ? 'var(--pub-accent)' : 'var(--pub-gray-6)'}`,
                                color: step >= n ? 'var(--pub-accent-strong)' : 'var(--pub-gray-4)',
                            }}
                        >
                            {n}
                        </span>
                        {n < 3 ? (
                            <span
                                className="h-px flex-1"
                                style={{ backgroundColor: step > n ? 'var(--pub-accent)' : 'var(--pub-gray-6)' }}
                            />
                        ) : null}
                    </div>
                ))}
            </div>

            {! paymentsEnabled ? (
                <p
                    className="mb-5 rounded-lg px-3 py-2 text-sm"
                    style={{ border: '1px solid var(--pub-gray-6)', color: 'var(--pub-gray-2)' }}
                >
                    Los pagos en línea no están disponibles en este momento. Escríbenos y activamos tu cuenta a mano.
                </p>
            ) : null}

            {/* ------------------------------------------------------- paso 1: plan */}
            {step === 1 && (
                <div className="space-y-3">
                    {sectionTitle(<CreditCard size={18} />, 'Elige tu plan')}

                    {plans.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--pub-gray-3)' }}>
                            No hay planes disponibles por ahora.
                        </p>
                    ) : (
                        plans.map((plan) => (
                            <button
                                key={plan.id}
                                type="button"
                                onClick={() => pickPlan(plan)}
                                className="w-full rounded-xl p-4 text-left transition-colors"
                                style={{
                                    border: `1px solid ${
                                        String(plan.id) === String(data.membership_plan_id)
                                            ? 'var(--pub-accent)'
                                            : 'var(--pub-gray-6)'
                                    }`,
                                }}
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-base" style={{ color: 'var(--pub-gray-1)' }}>
                                        {plan.name}
                                    </span>
                                    <span
                                        className="shrink-0 text-base tabular-nums"
                                        style={{ color: 'var(--pub-accent-strong)' }}
                                    >
                                        {plan.price_monthly != null ? formatCurrency(plan.price_monthly) : 'A convenir'}
                                        <span className="text-xs" style={{ color: 'var(--pub-gray-3)' }}>
                                            {' '}
                                            / mes
                                        </span>
                                    </span>
                                </div>

                                <p className="mt-1 text-xs" style={{ color: 'var(--pub-gray-3)' }}>
                                    {limit(plan.max_staff_users)} usuarios · {limit(plan.max_employees)} empleados
                                </p>

                                {plan.features.length > 0 ? (
                                    <ul className="mt-2 space-y-1">
                                        {plan.features.map((feature) => (
                                            <li
                                                key={feature}
                                                className="flex items-center gap-1.5 text-xs"
                                                style={{ color: 'var(--pub-gray-2)' }}
                                            >
                                                <Check size={13} style={{ color: 'var(--pub-accent)' }} />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </button>
                        ))
                    )}

                    {errors.membership_plan_id ? (
                        <p className="text-xs" style={{ color: 'var(--pub-danger, #fb7185)' }}>
                            {errors.membership_plan_id}
                        </p>
                    ) : null}
                </div>
            )}

            {/* ------------------------------------------------ paso 2: la empresa */}
            {step === 2 && (
                <form onSubmit={goToPayment} className="space-y-4">
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

                    <div className="flex gap-3">
                        <PublicButton type="button" quiet onClick={() => setStep(1)}>
                            Atrás
                        </PublicButton>
                        <PublicButton type="submit">
                            Siguiente
                            <ArrowRight size={18} />
                        </PublicButton>
                    </div>
                </form>
            )}

            {/* -------------------------------------- paso 3: administrador y pago */}
            {step === 3 && (
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

                    {/* Lo que se va a cobrar, antes de salir a la pasarela. */}
                    {selected ? (
                        <div
                            className="rounded-xl p-4"
                            style={{ border: '1px solid var(--pub-gray-6)' }}
                        >
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-sm" style={{ color: 'var(--pub-gray-2)' }}>
                                    Plan {selected.name} · primer mes
                                </span>
                                <span
                                    className="shrink-0 text-base tabular-nums"
                                    style={{ color: 'var(--pub-accent-strong)' }}
                                >
                                    {selected.price_monthly != null ? formatCurrency(selected.price_monthly) : '—'}
                                </span>
                            </div>
                            <p className="mt-1 text-xs" style={{ color: 'var(--pub-gray-3)' }}>
                                Te llevamos al pago seguro de Wompi. Tu cuenta queda activa apenas se apruebe.
                            </p>
                        </div>
                    ) : null}

                    {errors.membership_plan_id ? (
                        <p className="text-xs" style={{ color: 'var(--pub-danger, #fb7185)' }}>
                            {errors.membership_plan_id}
                        </p>
                    ) : null}

                    <div className="flex gap-3">
                        <PublicButton type="button" quiet onClick={() => setStep(2)}>
                            Atrás
                        </PublicButton>
                        <PublicButton type="submit" disabled={processing || ! paymentsEnabled}>
                            <CreditCard size={18} />
                            {processing ? 'Redirigiendo…' : 'Pagar y crear cuenta'}
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
