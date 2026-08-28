import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CaretDown, CaretRight, Lock, PencilSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { PermissionCatalogueEditor, type PermissionModule } from '@/Components/Permissions/PermissionCatalogueEditor';
import type { AffectedUser } from '@/Components/Permissions/RolePropagationDialog';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/utils';
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

interface ModuleCoverage {
    module: string;
    display: string;
    count: number;
    total: number;
}

interface Props {
    role: RoleData;
    catalogue: PermissionModule[];
    moduleCoverage: ModuleCoverage[];
    users: AffectedUser[];
    permissionsTotal: number;
    systemRoleNotice?: string;
}

export default function RoleShow({
    role,
    catalogue,
    moduleCoverage,
    users,
    permissionsTotal,
    systemRoleNotice,
}: Props) {
    const [catalogueOpen, setCatalogueOpen] = useState(false);

    const withOverrides = users.filter((user) => user.will_gain > 0 || user.will_lose > 0).length;

    const cards = [
        { label: 'Permisos', value: `${formatNumber(role.permissions.length)} de ${formatNumber(permissionsTotal)}`, muted: false },
        { label: 'Usuarios', value: formatNumber(users.length), muted: false },
        { label: 'Tipo', value: role.is_system ? 'Del sistema' : 'Propio', muted: false },
        { label: 'Identificador', value: role.name, muted: true },
    ];

    return (
        <AppLayout title={role.display_name}>
            <Head title={role.display_name} />

            <div className="emp-form -m-4 min-h-screen px-4 pb-10 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8">
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
                                style={{ backgroundColor: role.color }}
                            />
                            {role.display_name}
                            {role.is_system ? (
                                <span className="emp-pill">
                                    <Lock size={10} />
                                    Sistema
                                </span>
                            ) : null}
                        </h1>
                        <p className="mt-1 max-w-[620px] text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            {role.description || 'Sin descripción.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={route('roles.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Volver
                        </Link>
                        {! role.is_system ? (
                            <Can permission="roles.index.edit">
                                <Link href={route('roles.edit', role.id)} className="emp-btn emp-btn-sm emp-btn-primary">
                                    <PencilSimple size={14} />
                                    Editar plantilla
                                </Link>
                            </Can>
                        ) : null}
                    </div>
                </div>

                {systemRoleNotice ? <div className="emp-note mt-4">{systemRoleNotice}</div> : null}

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="emp-card p-[15px]">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 truncate text-[16px] tabular-nums"
                                style={{
                                    color: card.muted ? 'var(--emp-muted)' : 'var(--emp-text)',
                                    fontFamily: card.muted ? 'ui-monospace, monospace' : undefined,
                                }}
                            >
                                {card.value}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                    {/* --------------------------------------- cobertura */}
                    <section className="emp-card p-[18px]">
                        <p className="emp-kicker">Qué permite, por módulo</p>

                        <div className="mt-2 flex flex-col">
                            {moduleCoverage.map((row) => {
                                const percent = row.total > 0 ? Math.round((row.count / row.total) * 100) : 0;

                                return (
                                    <div
                                        key={row.module}
                                        className="emp-row-sep flex items-center gap-3 py-2"
                                    >
                                        <span
                                            className="min-w-0 flex-1 truncate text-[13px]"
                                            style={{ color: row.count > 0 ? 'var(--emp-text)' : 'var(--emp-subtle)' }}
                                        >
                                            {row.display}
                                        </span>

                                        <span
                                            aria-hidden="true"
                                            className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full lg:w-[112px]"
                                            style={{ backgroundColor: 'var(--emp-row)' }}
                                        >
                                            <span
                                                className="block h-full rounded-full"
                                                style={{ width: `${percent}%`, backgroundColor: role.color }}
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
                    </section>

                    {/* ------------------------------------------- usuarios */}
                    <section className="emp-card p-[18px]">
                        <header className="flex items-center justify-between gap-2">
                            <p className="emp-kicker">Usuarios con este rol</p>
                            <Link
                                href={route('users.index', { role_id: role.id })}
                                className="text-[12px]"
                                style={{ color: 'var(--emp-accent-on)' }}
                            >
                                Ver en Usuarios
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
                                            <span className="block truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {user.email} · {formatNumber(user.permissions_count)} permisos
                                            </span>
                                        </span>

                                        <CaretRight size={13} style={{ color: 'var(--emp-subtle)' }} />
                                    </Link>
                                ))}
                            </div>
                        )}

                        {withOverrides > 0 ? (
                            <div className="emp-note mt-3">
                                {withOverrides}{' '}
                                {withOverrides === 1
                                    ? 'persona tiene permisos que no coinciden'
                                    : 'personas tienen permisos que no coinciden'}{' '}
                                con esta plantilla. Es normal: se ajustan una a una y el rol no las pisa.
                            </div>
                        ) : null}
                    </section>
                </div>

                {/* ------------------------------------------- catalogo completo */}
                <section className="emp-card mt-4 p-[18px]">
                    <button
                        type="button"
                        onClick={() => setCatalogueOpen(! catalogueOpen)}
                        aria-expanded={catalogueOpen}
                        className="flex w-full items-center gap-2 text-left"
                    >
                        <span className="emp-kicker">Catálogo completo</span>
                        <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            solo lectura
                        </span>
                        <CaretDown
                            size={13}
                            className="ml-auto"
                            style={{
                                color: 'var(--emp-subtle)',
                                transform: catalogueOpen ? 'rotate(180deg)' : undefined,
                                transition: 'transform 120ms ease-out',
                            }}
                        />
                    </button>

                    {catalogueOpen ? (
                        <div className="mt-3">
                            <PermissionCatalogueEditor
                                catalogue={catalogue}
                                value={role.permissions}
                                onChange={() => {}}
                                variant="role"
                                readonly
                                summaryPosition="none"
                            />
                        </div>
                    ) : null}
                </section>
            </div>
        </AppLayout>
    );
}
