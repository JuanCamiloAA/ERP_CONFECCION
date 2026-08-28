import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowsClockwise, CaretDown, FloppyDisk, ShieldCheck } from '@phosphor-icons/react';
import { FormEvent, useMemo, useState } from 'react';
import { PermissionAssignerModal } from '@/Components/Permissions/PermissionAssignerModal';
import { UserAccessSwitch } from '@/Components/Users/UserAccessSwitch';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber, formatRelativeDate, formatRoleSelectLabel, generatePassword } from '@/lib/utils';
import '../../../css/module-ui.css';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    color?: string | null;
    company?: { id: number; name: string } | null;
}

interface CompanyOption {
    id: number;
    name: string;
}

interface UserData {
    id: number;
    name: string;
    last_name: string | null;
    email: string;
    phone: string | null;
    is_active: boolean;
    last_login_at?: string | null;
    company_id: number | null;
    roles: { id: number; name: string; display_name?: string; color?: string | null }[];
}

interface Props {
    user: UserData;
    roles: RoleOption[];
    companies: CompanyOption[];
    role_permissions: string[];
    assigned_permissions: string[];
    permission_labels: Record<string, string>;
    summary: { assigned: number; extra: number; missing: number; template: number };
    can_manage_permission_overrides: boolean;
}

export default function UserEdit({
    user,
    roles,
    companies,
    role_permissions,
    assigned_permissions,
    permission_labels,
    summary,
    can_manage_permission_overrides,
}: Props) {
    const currentRoleId = user.roles.length > 0 ? user.roles[0].id : ('' as number | '');
    const [permissionsOpen, setPermissionsOpen] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        last_name: user.last_name ?? '',
        email: user.email,
        phone: user.phone ?? '',
        password: '',
        password_confirmation: '',
        role_id: currentRoleId,
        company_id: (user.company_id ?? '') as number | '',
        is_active: user.is_active,
    });

    const isTargetSuperAdmin = user.roles.some((r) => r.name === 'super_admin');
    const roleColor = user.roles[0]?.color ?? '#6366f1';
    const initials = `${user.name.slice(0, 1)}${(user.last_name ?? '').slice(0, 1)}`.toUpperCase();

    /** Excepciones respecto a la plantilla del rol, ya resueltas para pintarlas. */
    const exceptions = useMemo(() => {
        const template = new Set(role_permissions);
        const assigned = new Set(assigned_permissions);

        return {
            extra: assigned_permissions.filter((name) => ! template.has(name)),
            missing: role_permissions.filter((name) => ! assigned.has(name)),
        };
    }, [role_permissions, assigned_permissions]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id));
    };

    const generate = () => {
        const password = generatePassword();
        setData((current) => ({ ...current, password, password_confirmation: password }));
    };

    return (
        <AppLayout title={`Editar ${user.name}`}>
            <Head title={`Editar ${user.name}`} />

            <form
                onSubmit={submit}
                className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span
                            aria-hidden="true"
                            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[14px]"
                            style={{ backgroundColor: `${roleColor}22`, color: roleColor }}
                        >
                            {initials}
                        </span>
                        <div className="min-w-0">
                            <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                                <Link href={route('users.index')} className="hover:underline">
                                    Usuarios
                                </Link>
                                <span aria-hidden="true">›</span>
                                <span>{user.name}</span>
                            </p>
                            <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                                {data.name} {data.last_name}
                            </h1>
                            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                {user.email}
                                {user.last_login_at
                                    ? ` · último acceso ${formatRelativeDate(user.last_login_at)}`
                                    : ' · sin entrar aún'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('users.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            <FloppyDisk size={14} />
                            {processing ? 'Guardando…' : 'Guardar cambios'}
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
                                        Nueva contraseña
                                    </label>
                                    <input
                                        id="user-password"
                                        type="text"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Deja en blanco para no cambiarla"
                                        className={`emp-field ${errors.password ? 'emp-field-error' : ''}`}
                                    />
                                    {errors.password ? <p className="emp-error">{errors.password}</p> : null}
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="user-password-confirm">
                                        Repetir contraseña
                                    </label>
                                    <input
                                        id="user-password-confirm"
                                        type="text"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        placeholder="Repite la contraseña"
                                        className="emp-field"
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
                                        Rol
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="user-role"
                                            value={data.role_id}
                                            onChange={(e) =>
                                                setData('role_id', e.target.value === '' ? '' : Number(e.target.value))
                                            }
                                            className={`emp-field ${errors.role_id ? 'emp-field-error' : ''}`}
                                        >
                                            <option value="">Sin rol</option>
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
                                                className="emp-field"
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
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </div>

                    {/* ------------------------------------ permisos efectivos */}
                    <section className="emp-card h-fit p-[18px]">
                        <p className="emp-kicker">Permisos efectivos</p>

                        {isTargetSuperAdmin ? (
                            <p className="mt-3 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                El super administrador tiene todos los permisos por definición; no se le asignan uno a
                                uno.
                            </p>
                        ) : ! can_manage_permission_overrides ? (
                            <p className="mt-3 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                No tienes permiso para ajustar los permisos de esta persona.
                            </p>
                        ) : (
                            <>
                                <div className="mt-2 flex items-end justify-between gap-3">
                                    <p className="text-[26px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                        {formatNumber(summary.assigned)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setPermissionsOpen(true)}
                                        className="emp-btn emp-btn-sm emp-btn-primary"
                                    >
                                        <ShieldCheck size={13} />
                                        Ajustar
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-col gap-1.5">
                                    {[
                                        {
                                            label: 'Vienen del rol',
                                            value: summary.assigned - summary.extra,
                                            color: 'var(--emp-accent)',
                                        },
                                        { label: 'Extra de esta persona', value: summary.extra, color: 'var(--emp-accent-line)' },
                                        { label: 'Quitados del rol', value: summary.missing, color: 'var(--emp-danger)' },
                                    ].map((row) => (
                                        <div key={row.label} className="flex items-center gap-2">
                                            <span
                                                aria-hidden="true"
                                                className="h-3 w-3 shrink-0 rounded-[4px]"
                                                style={{ backgroundColor: row.color }}
                                            />
                                            <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                                {row.label}
                                            </span>
                                            <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                                {formatNumber(row.value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {exceptions.extra.length > 0 || exceptions.missing.length > 0 ? (
                                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--emp-row)' }}>
                                        <p className="emp-kicker">Excepciones de esta persona</p>
                                        <div className="mt-1.5 flex max-h-[160px] flex-wrap gap-1.5 overflow-auto">
                                            {exceptions.extra.map((name) => (
                                                <span key={name} className="emp-pill emp-pill-accent" title={name}>
                                                    + {permission_labels[name] ?? name}
                                                </span>
                                            ))}
                                            {exceptions.missing.map((name) => (
                                                <span key={name} className="emp-pill emp-pill-warn" title={name}>
                                                    − {permission_labels[name] ?? name}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="emp-help">
                                            Se guardan aparte de los datos del usuario: cambiar su rol no las borra.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="emp-help">
                                        Sus permisos coinciden con la plantilla de su rol.
                                    </p>
                                )}
                            </>
                        )}
                    </section>
                </div>

                {/* Movil: guardar al alcance del pulgar. */}
                <div
                    className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary w-full">
                        <FloppyDisk size={17} />
                        {processing ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </form>

            <PermissionAssignerModal
                userId={permissionsOpen ? user.id : null}
                onClose={() => setPermissionsOpen(false)}
            />
        </AppLayout>
    );
}
