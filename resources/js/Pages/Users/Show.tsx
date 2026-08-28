import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CaretLeft, CaretRight, PencilSimple, ShieldCheck } from '@phosphor-icons/react';
import { useState } from 'react';
import { PermissionAssignerModal } from '@/Components/Permissions/PermissionAssignerModal';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import { formatDateTime, formatNumber, formatRelativeDate } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface AccessLog {
    id: number;
    action: string;
    description: string | null;
    ip_address: string | null;
    created_at: string;
}

interface UserData {
    id: number;
    name: string;
    last_name: string | null;
    full_name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    is_active: boolean;
    last_login_at: string | null;
    created_at?: string;
    company: { id: number; name: string } | null;
    roles: {
        id: number;
        name: string;
        display_name: string;
        color: string;
        permissions: { id: number; name: string }[];
    }[];
}

interface ModuleCoverage {
    module: string;
    display: string;
    count: number;
    total: number;
    extra: number;
    missing: number;
}

interface Props {
    user: UserData;
    accessLogs: PaginatedResponse<AccessLog>;
    summary: { assigned: number; extra: number; missing: number; template: number };
    moduleCoverage: ModuleCoverage[];
    canManagePermissions: boolean;
}

/** Etiqueta de pagina de Laravel, sin entidades ni las palabras de navegacion. */
function pageLabel(label: string): string {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', '')
        .replace('Next', '')
        .replace('Anterior', '')
        .replace('Siguiente', '')
        .trim();
}

export default function UserShow({ user, accessLogs, summary, moduleCoverage, canManagePermissions }: Props) {
    const [permissionsOpen, setPermissionsOpen] = useState<'all' | 'exceptions' | null>(null);

    const role = user.roles[0] ?? null;
    const color = role?.color ?? '#6366f1';
    const initials = `${user.name.slice(0, 1)}${(user.last_name ?? '').slice(0, 1)}`.toUpperCase();
    const touched = moduleCoverage.filter((row) => row.count > 0 || row.missing > 0);

    return (
        <AppLayout title={user.full_name}>
            <Head title={user.full_name} />

            <div className="emp-form -m-4 min-h-screen px-4 pb-10 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span
                            aria-hidden="true"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px]"
                            style={{ backgroundColor: `${color}22`, color }}
                        >
                            {initials}
                        </span>

                        <div className="min-w-0">
                            <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                                <Link href={route('users.index')} className="hover:underline">
                                    Usuarios
                                </Link>
                                <span aria-hidden="true">›</span>
                                <span>{user.full_name}</span>
                            </p>
                            <h1 className="mt-1 text-[24px]" style={{ color: 'var(--emp-text)' }}>
                                {user.full_name}
                            </h1>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <RoleBadge role={role} />
                                <span className={`emp-pill ${user.is_active ? 'emp-pill-accent' : 'emp-pill-warn'}`}>
                                    {user.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                                {user.company?.name ? <span className="emp-pill">{user.company.name}</span> : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={route('users.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Volver
                        </Link>
                        {canManagePermissions ? (
                            <button
                                type="button"
                                onClick={() => setPermissionsOpen('all')}
                                className="emp-btn emp-btn-sm"
                            >
                                <ShieldCheck size={14} />
                                Permisos
                            </button>
                        ) : null}
                        <Can permission="users.index.edit">
                            <Link href={route('users.edit', user.id)} className="emp-btn emp-btn-sm emp-btn-primary">
                                <PencilSimple size={14} />
                                Editar
                            </Link>
                        </Can>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-4">
                        {/* ------------------------------------ qué puede hacer */}
                        <section className="emp-card p-[18px]">
                            <header className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="emp-kicker">Qué puede hacer</p>
                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                    {formatNumber(summary.assigned)} permisos
                                </span>
                            </header>

                            {touched.length === 0 ? (
                                <p className="mt-3 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                    Esta cuenta todavía no tiene permisos asignados.
                                </p>
                            ) : (
                                <div className="mt-2 flex flex-col">
                                    {touched.map((row) => {
                                        const percent = row.total > 0 ? Math.round((row.count / row.total) * 100) : 0;

                                        return (
                                            <div key={row.module} className="emp-row-sep flex items-center gap-2.5 py-2">
                                                <span
                                                    className="min-w-0 flex-1 truncate text-[13px]"
                                                    style={{ color: 'var(--emp-text)' }}
                                                >
                                                    {row.display}
                                                </span>

                                                {row.extra > 0 ? (
                                                    <span className="emp-pill emp-pill-accent shrink-0">+{row.extra}</span>
                                                ) : null}
                                                {row.missing > 0 ? (
                                                    <span className="emp-pill emp-pill-warn shrink-0">−{row.missing}</span>
                                                ) : null}

                                                <span
                                                    aria-hidden="true"
                                                    className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full lg:w-[112px]"
                                                    style={{ backgroundColor: 'var(--emp-row)' }}
                                                >
                                                    <span
                                                        className="block h-full rounded-full"
                                                        style={{ width: `${percent}%`, backgroundColor: color }}
                                                    />
                                                </span>

                                                <span
                                                    className="w-[54px] shrink-0 text-right text-[12px] tabular-nums"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    {row.count} / {row.total}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* -------------------------------------- actividad */}
                        <section className="emp-card p-[18px]">
                            <p className="emp-kicker">Actividad reciente</p>

                            {accessLogs.data.length === 0 ? (
                                <p className="mt-3 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                    Sin actividad registrada.
                                </p>
                            ) : (
                                <div className="mt-2 flex flex-col">
                                    {accessLogs.data.map((log) => (
                                        <div key={log.id} className="emp-row-sep flex items-center gap-2.5 py-2">
                                            <span className="emp-pill shrink-0">{log.action}</span>
                                            <span
                                                className="min-w-0 flex-1 truncate text-[12.5px]"
                                                style={{ color: 'var(--emp-muted)' }}
                                                title={log.description ?? undefined}
                                            >
                                                {log.description ?? '—'}
                                            </span>
                                            <span
                                                className="shrink-0 text-[11.5px]"
                                                style={{ color: 'var(--emp-subtle)' }}
                                                title={formatDateTime(log.created_at)}
                                            >
                                                {formatRelativeDate(log.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {accessLogs.links.length > 3 ? (
                                <div className="mt-3 flex flex-wrap justify-end gap-1">
                                    {accessLogs.links.map((link, index) => {
                                        const isPrev = index === 0;
                                        const isNext = index === accessLogs.links.length - 1;

                                        return (
                                            <Link
                                                key={index}
                                                href={link.url ?? '#'}
                                                preserveScroll
                                                aria-current={link.active ? 'page' : undefined}
                                                className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-lg px-2 text-[12px] ${
                                                    link.active ? 'emp-seg-on' : ''
                                                } ${! link.url ? 'pointer-events-none opacity-40' : ''}`}
                                                style={{
                                                    border: '1px solid var(--emp-border)',
                                                    color: link.active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                                }}
                                            >
                                                {isPrev ? <CaretLeft size={13} /> : isNext ? <CaretRight size={13} /> : pageLabel(link.label)}
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </section>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* ------------------------------------------------ ficha */}
                        <section className="emp-card p-[18px]">
                            <p className="emp-kicker">Ficha</p>

                            <dl className="mt-2 flex flex-col">
                                {[
                                    { label: 'Correo', value: user.email },
                                    { label: 'Teléfono', value: user.phone || '—' },
                                    { label: 'Empresa', value: user.company?.name ?? '—' },
                                    { label: 'Creado', value: user.created_at ? formatDateTime(user.created_at) : '—' },
                                    {
                                        label: 'Último acceso',
                                        value: user.last_login_at ? formatDateTime(user.last_login_at) : 'Sin entrar aún',
                                    },
                                ].map((row) => (
                                    <div key={row.label} className="emp-row-sep flex items-baseline justify-between gap-3 py-1.5">
                                        <dt className="shrink-0 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {row.label}
                                        </dt>
                                        <dd className="min-w-0 truncate text-[12.5px]" style={{ color: 'var(--emp-text)' }}>
                                            {row.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        {/* -------------------------------------------- su rol */}
                        <section className="emp-card p-[18px]">
                            <header className="flex items-center justify-between gap-2">
                                <p className="emp-kicker">Su rol</p>
                                {role ? (
                                    <Link
                                        href={route('roles.show', role.id)}
                                        className="text-[12px]"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Ver plantilla
                                    </Link>
                                ) : null}
                            </header>

                            <div className="mt-2">
                                <RoleBadge role={role} />
                            </div>

                            <p className="mt-2 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                {role
                                    ? `${formatNumber(summary.template)} permisos en la plantilla. Esta persona tiene ${formatNumber(summary.extra)} extra y ${formatNumber(summary.missing)} quitados.`
                                    : 'Sin rol asignado: sus permisos se gestionan solo persona a persona.'}
                            </p>

                            {canManagePermissions && (summary.extra > 0 || summary.missing > 0) ? (
                                <button
                                    type="button"
                                    onClick={() => setPermissionsOpen('exceptions')}
                                    className="emp-btn emp-btn-sm mt-2.5"
                                >
                                    Comparar con la plantilla
                                </button>
                            ) : null}
                        </section>
                    </div>
                </div>
            </div>

            <PermissionAssignerModal
                userId={permissionsOpen !== null ? user.id : null}
                onClose={() => setPermissionsOpen(null)}
                initialOriginFilter={permissionsOpen === 'exceptions' ? 'exceptions' : 'all'}
            />
        </AppLayout>
    );
}
