import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Envelope, Eye, EyeSlash, IdentificationCard, LockKey } from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import AuthLayout from '@/Layouts/AuthLayout';

interface LoginProps {
    loginCompany?: { id: number; name: string; logo_url: string | null } | null;
}

type LoginMode = 'email' | 'document';

export default function Login({ loginCompany = null }: LoginProps) {
    const { data, setData, post, processing, errors, clearErrors, reset } = useForm({
        login_mode: 'email' as LoginMode,
        email: '',
        document: '',
        password: '',
        remember: false,
    });
    const [showPassword, setShowPassword] = useState(false);

    const byDocument = data.login_mode === 'document';

    /** Cambia de credencial: limpia la otra y sus errores para no arrastrar lo ya escrito. */
    const switchMode = (mode: LoginMode) => {
        if (mode === data.login_mode) return;
        setData((current) => ({
            ...current,
            login_mode: mode,
            email: mode === 'email' ? current.email : '',
            document: mode === 'document' ? current.document : '',
        }));
        clearErrors('email', 'document');
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const url =
            loginCompany?.id != null ? `${route('login')}?company=${loginCompany.id}` : route('login');
        post(url, {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="Iniciar sesión" description="Ingresa tus credenciales para acceder al sistema.">
            <Head title="Iniciar sesion" />

            {/* pb en movil para que la barra fija del boton no tape el ultimo control. */}
            <form id="login-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4 pb-28 lg:block lg:space-y-4 lg:pb-0">
                {/* Con que credencial entrar. El backend recibe login_mode y valida solo la elegida. */}
                <div
                    role="tablist"
                    aria-label="Forma de ingreso"
                    className="flex w-full gap-1 rounded-lg p-1 lg:inline-flex lg:w-auto lg:self-start"
                    style={{ border: '1px solid var(--pub-gray-6)' }}
                >
                    {([
                        { mode: 'email' as LoginMode, label: 'Correo' },
                        { mode: 'document' as LoginMode, label: 'Documento' },
                    ]).map(({ mode, label }) => {
                        const active = data.login_mode === mode;

                        return (
                            <button
                                key={mode}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => switchMode(mode)}
                                className="flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-[13px] transition-colors lg:flex-none lg:justify-start lg:px-2"
                                style={{
                                    backgroundColor: active ? 'var(--pub-accent-fill)' : 'transparent',
                                    color: active ? 'var(--pub-accent)' : 'var(--pub-gray-2)',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {byDocument ? (
                    <div>
                        <label htmlFor="login-document" className="mb-1.5 block text-sm" style={{ color: 'var(--pub-gray-1)' }}>
                            Documento
                        </label>
                        <div className="pub-field-shell h-13 px-3.5 lg:h-11">
                            <IdentificationCard size={18} style={{ color: 'var(--pub-gray-4)' }} aria-hidden="true" />
                            <input
                                id="login-document"
                                type="text"
                                inputMode="numeric"
                                value={data.document}
                                onChange={(e) => setData('document', e.target.value)}
                                placeholder="Número de documento"
                                className="text-[15px]"
                                required
                                autoFocus
                                autoComplete="username"
                            />
                        </div>
                        {errors.document ? (
                            <p className="mt-1.5 text-xs" style={{ color: 'var(--pub-danger)' }}>
                                {errors.document}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <div>
                        <label htmlFor="login-email" className="mb-1.5 block text-sm" style={{ color: 'var(--pub-gray-1)' }}>
                            Correo electrónico
                        </label>
                        <div className="pub-field-shell h-13 px-3.5 lg:h-11">
                            <Envelope size={18} style={{ color: 'var(--pub-gray-4)' }} aria-hidden="true" />
                            <input
                                id="login-email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="tucorreo@empresa.com"
                                className="text-[15px]"
                                required
                                autoFocus
                                autoComplete="email"
                            />
                        </div>
                        {errors.email ? (
                            <p className="mt-1.5 text-xs" style={{ color: 'var(--pub-danger)' }}>
                                {errors.email}
                            </p>
                        ) : null}
                    </div>
                )}

                <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-sm" style={{ color: 'var(--pub-gray-1)' }}>
                        Contraseña
                    </label>
                    <div className="pub-field-shell h-13 pl-3.5 pr-1.5 lg:h-11">
                        <LockKey size={18} style={{ color: 'var(--pub-gray-4)' }} aria-hidden="true" />
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="********"
                            className="text-[15px]"
                            required
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm lg:h-9 lg:w-9"
                            style={{ color: 'var(--pub-gray-3)' }}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password ? (
                        <p className="mt-1.5 text-xs" style={{ color: 'var(--pub-danger)' }}>
                            {errors.password}
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--pub-gray-2)' }}>
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="h-4 w-4 rounded-[3px]"
                            style={{ accentColor: 'var(--pub-accent)' }}
                        />
                        Recordarme
                    </label>
                    <Link
                        href={route('password.request')}
                        className="flex min-h-11 items-center text-sm"
                        style={{ color: 'var(--pub-accent)' }}
                    >
                        ¿Olvidaste tu clave?
                    </Link>
                </div>

                {/* Escritorio: el boton va en el flujo del formulario.
                    Se oculta con un contenedor y no con "hidden" sobre el propio boton, porque
                    .pub-btn fija display:inline-flex y pisaria la utilidad de Tailwind. */}
                <div className="hidden lg:block">
                    <button type="submit" disabled={processing} className="pub-btn h-11.5 w-full text-[15px]">
                        {processing ? 'Entrando…' : 'Entrar'}
                        {processing ? null : <ArrowRight size={17} aria-hidden="true" />}
                    </button>
                </div>

                <div className="mt-auto space-y-2 lg:mt-0 lg:space-y-4">
                    <p className="text-[13px]" style={{ color: 'var(--pub-gray-4)' }}>
                        ¿Problemas para entrar? Habla con el administrador de tu taller.
                    </p>

                    <p className="text-[13px]">
                        <Link
                            href={route('landing')}
                            className="inline-flex min-h-11 items-center"
                            style={{ color: 'var(--pub-accent)' }}
                        >
                            Volver al sitio público
                        </Link>
                    </p>
                </div>
            </form>

            {/* Movil: accion primaria fija al fondo, 52px, al alcance del pulgar. */}
            <div
                className="fixed inset-x-0 bottom-0 z-30 px-4 pb-5 pt-3 lg:hidden"
                style={{ backgroundColor: 'var(--pub-bg)', borderTop: '1px solid var(--pub-divider)' }}
            >
                <button type="submit" form="login-form" disabled={processing} className="pub-btn h-13 w-full text-[15px]">
                    {processing ? 'Entrando…' : 'Entrar'}
                    {processing ? null : <ArrowRight size={17} aria-hidden="true" />}
                </button>
            </div>
        </AuthLayout>
    );
}
