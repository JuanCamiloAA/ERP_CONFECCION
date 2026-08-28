import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, CaretRight, FloppyDisk } from '@phosphor-icons/react';
import { FormEvent } from 'react';
import { PermissionCatalogueEditor, type PermissionModule } from '@/Components/Permissions/PermissionCatalogueEditor';
import {
    RolePropagationDialog,
    type AffectedUser,
    type PendingDiff,
} from '@/Components/Permissions/RolePropagationDialog';
import AppLayout from '@/Layouts/AppLayout';
import { ROLE_COLOR_PRESETS } from '@/lib/permissions';
import { formatNumber, slugify } from '@/lib/utils';
import '../../../css/module-ui.css';

interface RoleData {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    permissions: string[];
}

interface Props {
    role: RoleData;
    catalogue: PermissionModule[];
    users: AffectedUser[];
    permissionsTotal: number;
    /** Cambio recién guardado en la plantilla que todavía no se aplicó a nadie. */
    pendingDiff: PendingDiff | null;
    affectedUsers: AffectedUser[];
    permissionLabels: Record<string, string>;
}


export default function RoleEdit({
    role,
    catalogue,
    users,
    permissionsTotal,
    pendingDiff,
    affectedUsers,
    permissionLabels,
}: Props) {
    const { data, setData, put, processing, errors } = useForm({
        display_name: role.display_name,
        name: role.name,
        description: role.description ?? '',
        color: role.color,
        permissions: role.permissions ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('roles.update', role.id));
    };

    return (
        <AppLayout title={`Editar ${role.display_name}`}>
            <Head title={`Editar ${role.display_name}`} />

            <form
                onSubmit={submit}
                className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('roles.index')} className="hover:underline">
                                Roles
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>{role.display_name}</span>
                        </p>

                        <h1 className="mt-1 flex items-center gap-2 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            <span
                                aria-hidden="true"
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: data.color }}
                            />
                            {data.display_name || role.display_name}
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Plantilla · {formatNumber(users.length)}{' '}
                            {users.length === 1 ? 'usuario la usa hoy' : 'usuarios la usan hoy'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('roles.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Cancelar
                        </Link>
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            <FloppyDisk size={14} />
                            {processing ? 'Guardando…' : 'Guardar plantilla'}
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                    {/* ------------------------------------------ datos del rol */}
                    <section className="emp-card p-[18px]">
                        <p className="emp-kicker">Datos del rol</p>

                        <div className="mt-3 flex flex-col gap-[14px]">
                            <div>
                                <label className="emp-label" htmlFor="role-display-name">
                                    Nombre visible <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="role-display-name"
                                    value={data.display_name}
                                    onChange={(e) => setData('display_name', e.target.value)}
                                    className={`emp-field ${errors.display_name ? 'emp-field-error' : ''}`}
                                    required
                                />
                                {errors.display_name ? <p className="emp-error">{errors.display_name}</p> : null}
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="role-name">
                                    Identificador interno <span className="emp-req">*</span>
                                </label>
                                <input
                                    id="role-name"
                                    value={data.name}
                                    onChange={(e) => setData('name', slugify(e.target.value))}
                                    className={`emp-field ${errors.name ? 'emp-field-error' : ''}`}
                                    style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                                    required
                                />
                                {errors.name ? <p className="emp-error">{errors.name}</p> : null}
                                <p className="emp-help">Se genera del nombre; cámbialo solo si sabes lo que hace.</p>
                            </div>

                            <div>
                                <label className="emp-label" htmlFor="role-description">
                                    Para qué sirve este rol
                                </label>
                                <textarea
                                    id="role-description"
                                    rows={2}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    className="emp-field"
                                />
                                <p className="emp-help">Se lee en el selector de rol al crear un usuario.</p>
                            </div>

                            <div>
                                <span className="emp-label">Color de la etiqueta</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {ROLE_COLOR_PRESETS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setData('color', color)}
                                            aria-label={`Color ${color}`}
                                            aria-pressed={data.color === color}
                                            className="h-[26px] w-[26px] rounded-full"
                                            style={{
                                                backgroundColor: color,
                                                border:
                                                    data.color === color
                                                        ? '2px solid var(--emp-accent-line)'
                                                        : '2px solid transparent',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ---------------------------------------- a quién afecta */}
                    <section className="emp-card p-[18px]">
                        <header className="flex items-center justify-between gap-2">
                            <p className="emp-kicker">A quién afecta</p>
                            <Link
                                href={route('users.index', { role_id: role.id })}
                                className="text-[12px]"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Ver usuarios
                            </Link>
                        </header>

                        {users.length === 0 ? (
                            <p className="mt-3 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Todavía nadie usa esta plantilla.
                            </p>
                        ) : (
                            <div className="mt-2 flex flex-col">
                                {users.map((user) => (
                                    <Link
                                        key={user.id}
                                        href={route('users.show', user.id)}
                                        className="emp-hover-row emp-row-sep flex items-center gap-2.5 px-1 py-2"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px]"
                                            style={{ backgroundColor: `${role.color}22`, color: role.color }}
                                        >
                                            {user.name.slice(0, 1).toUpperCase()}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                                {user.name}
                                            </span>
                                            <span className="block text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {formatNumber(user.permissions_count)} permisos ·{' '}
                                                {user.is_active ? 'activo' : 'inactivo'}
                                            </span>
                                        </span>

                                        {user.will_gain > 0 || user.will_lose > 0 ? (
                                            <span className="emp-pill emp-pill-accent shrink-0">
                                                +{user.will_gain + user.will_lose} extra
                                            </span>
                                        ) : null}

                                        <CaretRight size={13} style={{ color: 'var(--emp-subtle)' }} />
                                    </Link>
                                ))}
                            </div>
                        )}

                        <div className="emp-note mt-3">
                            Al guardar eliges usuario por usuario quién recibe el cambio. Las excepciones de cada
                            persona no se pisan.
                        </div>
                    </section>
                </div>

                {/* ------------------------------------ permisos de la plantilla */}
                <section className="emp-card mt-4 p-[18px]">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="emp-kicker">Permisos de la plantilla</p>
                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                            {formatNumber(data.permissions.length)} de {formatNumber(permissionsTotal)}
                        </span>
                    </header>

                    <div className="mt-3">
                        <PermissionCatalogueEditor
                            catalogue={catalogue}
                            value={data.permissions}
                            onChange={(perms) => setData('permissions', perms)}
                            variant="role"
                            baseline={role.permissions ?? []}
                            labels={permissionLabels}
                            summaryPosition="sticky"
                        />
                    </div>

                    {errors.permissions ? <p className="emp-error">{errors.permissions}</p> : null}
                </section>

                {/* Movil: guardar al alcance del pulgar. */}
                <div
                    className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary w-full">
                        <FloppyDisk size={17} />
                        {processing ? 'Guardando…' : 'Guardar plantilla'}
                    </button>
                </div>
            </form>

            <RolePropagationDialog
                roleId={role.id}
                roleName={role.display_name}
                diff={pendingDiff}
                users={affectedUsers}
                labels={permissionLabels}
            />
        </AppLayout>
    );
}
