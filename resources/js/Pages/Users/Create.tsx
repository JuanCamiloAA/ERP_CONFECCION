import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowsClockwise, CaretDown, FloppyDisk } from '@phosphor-icons/react';
import { FormEvent } from 'react';
import { UserAccessSwitch } from '@/Components/Users/UserAccessSwitch';
import AppLayout from '@/Layouts/AppLayout';
import { formatRoleSelectLabel, generatePassword } from '@/lib/utils';
import '../../../css/module-ui.css';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    description?: string | null;
    company?: { id: number; name: string } | null;
}

interface CompanyOption {
    id: number;
    name: string;
}

interface Props {
    roles: RoleOption[];
    companies: CompanyOption[];
}

export default function UserCreate({ roles, companies }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        role_id: '' as number | '',
        company_id: '' as number | '',
        is_active: true,
    });

    const selectedRole = roles.find((role) => role.id === data.role_id) ?? null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('users.store'));
    };

    const generate = () => {
        const password = generatePassword();
        setData((current) => ({ ...current, password, password_confirmation: password }));
    };

    return (
        <AppLayout title="Nuevo usuario">
            <Head title="Nuevo usuario" />

            <form
                onSubmit={submit}
                className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('users.index')} className="hover:underline">
                                Usuarios
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>Nuevo</span>
                        </p>
                        <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            {data.name || 'Nuevo usuario'} {data.last_name}
                        </h1>
                        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            {data.email || 'Se crea con los permisos de la plantilla del rol que elijas.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('users.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            <FloppyDisk size={14} />
                            {processing ? 'Creando…' : 'Crear usuario'}
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-4">
                        {/* ------------------------------------------ identidad */}
                        <section className="emp-card p-[18px]">
                            <p className="emp-kicker">Identidad</p>

                            <div className="mt-3 grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                                <div>
                                    <label className="emp-label" htmlFor="user-name">
                                        Nombre <span className="emp-req">*</span>
                                    </label>
                                    <input
                                        id="user-name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className={`emp-field ${errors.name ? 'emp-field-error' : ''}`}
                                        required
                                    />
                                    {errors.name ? <p className="emp-error">{errors.name}</p> : null}
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="user-last-name">
                                        Apellido
                                    </label>
                                    <input
                                        id="user-last-name"
                                        value={data.last_name}
                                        onChange={(e) => setData('last_name', e.target.value)}
                                        className="emp-field"
                                    />
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="user-email">
                                        Correo <span className="emp-req">*</span>
                                    </label>
                                    <input
                                        id="user-email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className={`emp-field ${errors.email ? 'emp-field-error' : ''}`}
                                        required
                                    />
                                    {errors.email ? <p className="emp-error">{errors.email}</p> : null}
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="user-phone">
                                        Teléfono
                                    </label>
                                    <input
                                        id="user-phone"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        className="emp-field"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* ----------------------------------------- contraseña */}
                        <section className="emp-card p-[18px]">
                            <header className="flex items-center justify-between gap-2">
                                <p className="emp-kicker">Contraseña</p>
                                <button type="button" onClick={generate} className="emp-btn emp-btn-sm">
                                    <ArrowsClockwise size={13} />
                                    Generar
                                </button>
                            </header>

                            <div className="mt-3 grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                                <div>
                                    <label className="emp-label" htmlFor="user-password">
                                        Contraseña <span className="emp-req">*</span>
                                    </label>
                                    <input
                                        id="user-password"
                                        type="text"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        className={`emp-field ${errors.password ? 'emp-field-error' : ''}`}
                                        required
                                    />
                                    {errors.password ? <p className="emp-error">{errors.password}</p> : null}
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="user-password-confirm">
                                        Repetir contraseña <span className="emp-req">*</span>
                                    </label>
                                    <input
                                        id="user-password-confirm"
                                        type="text"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        placeholder="Repite la contraseña"
                                        className="emp-field"
                                        required
                                    />
                                </div>
                            </div>
                        </section>

                        {/* --------------------------------------------- acceso */}
                        <section className="emp-card p-[18px]">
                            <p className="emp-kicker">Acceso</p>

                            <div className="mt-3 flex flex-col gap-[14px]">
                                <UserAccessSwitch
                                    checked={data.is_active}
                                    onChange={(value) => setData('is_active', value)}
                                />

                                <div>
                                    <label className="emp-label" htmlFor="user-role">
                                        Rol <span className="emp-req">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="user-role"
                                            value={data.role_id}
                                            onChange={(e) =>
                                                setData('role_id', e.target.value === '' ? '' : Number(e.target.value))
                                            }
                                            className={`emp-field ${errors.role_id ? 'emp-field-error' : ''}`}
                                            required
                                        >
                                            <option value="">Selecciona un rol</option>
                                            {roles.map((role) => (
                                                <option key={role.id} value={role.id}>
                                                    {formatRoleSelectLabel(role)}
                                                </option>
                                            ))}
                                        </select>
                                        <CaretDown
                                            size={13}
                                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                            style={{ color: 'var(--emp-subtle)' }}
                                        />
                                    </div>
                                    {errors.role_id ? <p className="emp-error">{errors.role_id}</p> : null}
                                    <p className="emp-help">
                                        El rol precarga permisos; después puedes ajustarlos persona por persona.
                                    </p>
                                </div>

                                {companies.length > 0 ? (
                                    <div>
                                        <label className="emp-label" htmlFor="user-company">
                                            Empresa
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="user-company"
                                                value={data.company_id}
                                                onChange={(e) =>
                                                    setData(
                                                        'company_id',
                                                        e.target.value === '' ? '' : Number(e.target.value),
                                                    )
                                                }
                                                className={`emp-field ${errors.company_id ? 'emp-field-error' : ''}`}
                                            >
                                                <option value="">Sin empresa</option>
                                                {companies.map((company) => (
                                                    <option key={company.id} value={company.id}>
                                                        {company.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <CaretDown
                                                size={13}
                                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--emp-subtle)' }}
                                            />
                                        </div>
                                        {errors.company_id ? <p className="emp-error">{errors.company_id}</p> : null}
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </div>

                    {/* ------------------------------------------------- ayuda */}
                    <section className="emp-card h-fit p-[18px]">
                        <p className="emp-kicker">Permisos</p>
                        <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                            {selectedRole
                                ? `Al crear la cuenta se le copian los permisos de la plantilla «${selectedRole.display_name}».`
                                : 'Elige un rol: sus permisos se copiarán a la cuenta al crearla.'}
                        </p>
                        {selectedRole?.description ? (
                            <p className="mt-1.5 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                {selectedRole.description}
                            </p>
                        ) : null}
                        <div className="emp-note mt-3">
                            Después podrás ajustarlos con el botón del escudo del listado, sin tocar la plantilla ni a
                            las demás personas con ese rol.
                        </div>
                    </section>
                </div>

                {/* Movil: crear al alcance del pulgar. */}
                <div
                    className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary w-full">
                        <FloppyDisk size={17} />
                        {processing ? 'Creando…' : 'Crear usuario'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
