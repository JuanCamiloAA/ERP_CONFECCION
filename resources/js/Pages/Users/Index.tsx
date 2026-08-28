import { Head, Link, router } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
    CaretDown,
    CaretLeft,
    CaretRight,
    DotsThreeVertical,
    Key,
    MagnifyingGlass,
    PencilSimple,
    Plus,
    Prohibit,
    ShieldCheck,
    Trash,
} from '@phosphor-icons/react';
import { Fragment, useEffect, useState } from 'react';
import { PermissionAssignerModal } from '@/Components/Permissions/PermissionAssignerModal';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber, formatRelativeDate } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    color?: string | null;
}

interface UserRow {
    id: number;
    name: string;
    last_name: string | null;
    full_name: string;
    email: string;
    initials?: string;
    avatar: string | null;
    is_active: boolean;
    last_login_at: string | null;
    company: { id: number; name: string } | null;
    roles: RoleOption[];
    permissions_count: number;
    extra_count: number;
    missing_count: number;
}

interface Metrics {
    total: number;
    active: number;
    inactive: number;
    never_logged_in: number;
    with_overrides: number;
}

interface Props {
    users: PaginatedResponse<UserRow>;
    filters: { search: string; status: string; company_id?: string | number | null; role_id?: number | null };
    roles: RoleOption[];
    metrics: Metrics;
}

const STATUS_SEGMENTS = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
];

const USER_GRID = 'minmax(0,1fr) 150px 168px 150px 130px 108px';

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

function initialsOf(user: UserRow): string {
    return (
        user.initials ??
        `${user.name.slice(0, 1)}${(user.last_name ?? '').slice(0, 1)}`.toUpperCase().trim() ??
        'U'
    );
}

export default function UsersIndex({ users, filters, roles, metrics }: Props) {
    const { isSuperAdmin } = usePermissions();
    const [term, setTerm] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
    const [permissionsFor, setPermissionsFor] = useState<number | null>(null);

    const rows = users.data;

    const apply = (next: Partial<{ search: string; status: string; role_id: string }>) => {
        const params: Record<string, string> = {};
        const search = next.search ?? term;
        const status = next.status ?? (filters.status ?? 'all');
        const roleId = next.role_id ?? (filters.role_id != null ? String(filters.role_id) : '');

        if (search) params.search = search;
        if (status !== 'all') params.status = status;
        if (roleId) params.role_id = roleId;
        if (filters.company_id != null && filters.company_id !== '') {
            params.company_id = String(filters.company_id);
        }

        router.get(route('users.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    /** La búsqueda espera 300 ms para no disparar una petición por letra. */
    useEffect(() => {
        if (term === (filters.search ?? '')) return;

        const timer = window.setTimeout(() => apply({ search: term }), 300);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term]);

    const metricCards = [
        { label: 'Activos', value: metrics.active, meta: 'pueden iniciar sesión', accent: false },
        { label: 'Inactivos', value: metrics.inactive, meta: 'acceso bloqueado', accent: false },
        { label: 'Con excepciones', value: metrics.with_overrides, meta: 'permisos fuera del rol', accent: true },
        { label: 'Sin entrar aún', value: metrics.never_logged_in, meta: 'creado, nunca usado', accent: false },
    ];

    const permissionCell = (user: UserRow) => (
        <span className="flex flex-wrap items-center gap-1">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatNumber(user.permissions_count)}
            </span>
            {user.extra_count > 0 ? (
                <span
                    className="emp-pill emp-pill-accent"
                    title={`${user.extra_count} permiso(s) que no están en su rol`}
                >
                    +{user.extra_count} extra
                </span>
            ) : null}
            {user.missing_count > 0 ? (
                <span
                    className="emp-pill emp-pill-warn"
                    title={`${user.missing_count} permiso(s) de su rol que le fueron quitados`}
                >
                    −{user.missing_count}
                </span>
            ) : null}
        </span>
    );

    const rowMenu = (user: UserRow) => {
        const item =
            'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';

        return (
            <Menu as="div" className="relative shrink-0">
                <MenuButton
                    aria-label={`Acciones de ${user.full_name}`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <DotsThreeVertical size={17} weight="bold" />
                </MenuButton>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <MenuItems
                        anchor="bottom end"
                        className="emp-card z-50 w-56 py-1 focus:outline-none"
                        style={{ backgroundColor: 'var(--emp-surface)' }}
                    >
                        <MenuItem>
                            <Link href={route('users.show', user.id)} className={item} style={{ color: 'var(--emp-text)' }}>
                                <Key size={15} />
                                Ver ficha
                            </Link>
                        </MenuItem>

                        <Can permission="users.index.edit">
                            <MenuItem>
                                <Link
                                    href={route('users.edit', user.id)}
                                    className={item}
                                    style={{ color: 'var(--emp-text)' }}
                                >
                                    <Prohibit size={15} />
                                    {user.is_active ? 'Inactivar desde su ficha' : 'Activar desde su ficha'}
                                </Link>
                            </MenuItem>
                        </Can>

                        <Can permission="users.index.delete">
                            <MenuItem>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(user)}
                                    className={item}
                                    style={{ color: 'var(--emp-danger)' }}
                                >
                                    <Trash size={15} />
                                    Eliminar
                                </button>
                            </MenuItem>
                        </Can>
                    </MenuItems>
                </Transition>
            </Menu>
        );
    };

    return (
        <AppLayout title="Usuarios">
            <Head title="Usuarios" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Usuarios
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Quién entra al sistema, con qué rol y con qué excepciones.
                        </p>
                    </div>

                    <Can permission="users.index.create">
                        <Link href={route('users.create')} className="emp-btn emp-btn-primary max-sm:hidden">
                            <Plus size={14} />
                            Nuevo usuario
                        </Link>
                    </Can>
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {metricCards.map((card) => (
                        <div key={card.label} className="emp-card p-[15px]">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 text-[26px] leading-none tabular-nums"
                                style={{ color: card.accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {formatNumber(card.value)}
                            </p>
                            <p className="mt-1 truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                {card.meta}
                            </p>
                        </div>
                    ))}
                </div>

                {isSuperAdmin && filters.company_id != null && filters.company_id !== '' ? (
                    <div className="emp-note mt-4 flex flex-wrap items-center justify-between gap-2">
                        <span>
                            Filtrando usuarios de la empresa <strong>{String(filters.company_id)}</strong>
                        </span>
                        <Link href={route('users.index')} className="emp-btn emp-btn-sm">
                            Quitar filtro de empresa
                        </Link>
                    </div>
                ) : null}

                {/* --------------------------------------------------- filtros */}
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 sm:max-w-[320px] sm:flex-1">
                        <MagnifyingGlass
                            size={15}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar por nombre o correo..."
                            aria-label="Buscar usuario"
                            className="emp-field pl-8"
                        />
                    </div>

                    <div className="emp-seg sm:w-[260px]">
                        {STATUS_SEGMENTS.map((segment) => (
                            <button
                                key={segment.value}
                                type="button"
                                onClick={() => apply({ status: segment.value })}
                                className={`emp-seg-item ${(filters.status ?? 'all') === segment.value ? 'emp-seg-on' : ''}`}
                            >
                                {segment.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-[190px] shrink-0 max-sm:hidden">
                        <select
                            value={filters.role_id != null ? String(filters.role_id) : ''}
                            onChange={(e) => apply({ role_id: e.target.value })}
                            aria-label="Filtrar por rol"
                            className="emp-field"
                        >
                            <option value="">Todos los roles</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.display_name}
                                </option>
                            ))}
                        </select>
                        <CaretDown
                            size={13}
                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--emp-subtle)' }}
                        />
                    </div>

                    <span className="shrink-0 text-[12px] max-sm:hidden sm:ml-auto" style={{ color: 'var(--emp-subtle)' }}>
                        {formatNumber(users.total ?? rows.length)} {(users.total ?? rows.length) === 1 ? 'usuario' : 'usuarios'}
                    </span>
                </div>

                {/* -------------------------------------------------- listado */}
                {rows.length === 0 ? (
                    <div className="emp-card mt-4 p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        No se encontraron usuarios con este filtro.
                    </div>
                ) : (
                    <>
                        {/* Escritorio: tabla. */}
                        <div className="mt-4 hidden lg:block">
                            <div
                                className="grid items-center gap-2.5 px-3 pb-2"
                                style={{ gridTemplateColumns: USER_GRID, borderBottom: '1px solid var(--emp-border)' }}
                            >
                                {['Usuario', 'Rol', 'Permisos', 'Empresa', 'Último acceso', ''].map((column, index) => (
                                    <span key={column || index} className="emp-kicker">
                                        {column}
                                    </span>
                                ))}
                            </div>

                            {rows.map((user) => {
                                const role = user.roles[0] ?? null;
                                const color = role?.color ?? '#6366f1';

                                return (
                                    <div
                                        key={user.id}
                                        className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3"
                                        style={{ gridTemplateColumns: USER_GRID, paddingTop: '11px', paddingBottom: '11px' }}
                                    >
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <span
                                                aria-hidden="true"
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px]"
                                                style={{ backgroundColor: `${color}22`, color }}
                                            >
                                                {initialsOf(user)}
                                            </span>
                                            <div className="min-w-0">
                                                <Link
                                                    href={route('users.show', user.id)}
                                                    className="block truncate text-[13.5px] hover:underline"
                                                    style={{ color: 'var(--emp-text)' }}
                                                >
                                                    {user.full_name}
                                                </Link>
                                                <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>

                                        <span>
                                            <RoleBadge role={role} />
                                        </span>

                                        {permissionCell(user)}

                                        <span className="truncate text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                            {user.company?.name ?? '—'}
                                        </span>

                                        <span className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                            {user.last_login_at ? formatRelativeDate(user.last_login_at) : 'sin entrar aún'}
                                        </span>

                                        <div className="flex items-center justify-end gap-0.5">
                                            <Can permission="users.edit.permission_overrides">
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionsFor(user.id)}
                                                    aria-label={`Asignar permisos a ${user.full_name}`}
                                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                                    style={{ color: 'var(--emp-accent-on)' }}
                                                >
                                                    <ShieldCheck size={15} />
                                                </button>
                                            </Can>
                                            <Can permission="users.index.edit">
                                                <Link
                                                    href={route('users.edit', user.id)}
                                                    aria-label={`Editar a ${user.full_name}`}
                                                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                                                    style={{ color: 'var(--emp-muted)' }}
                                                >
                                                    <PencilSimple size={15} />
                                                </Link>
                                            </Can>
                                            {rowMenu(user)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Movil: tarjetas. */}
                        <div className="mt-4 flex flex-col gap-2 lg:hidden">
                            {rows.map((user) => {
                                const role = user.roles[0] ?? null;
                                const color = role?.color ?? '#6366f1';

                                return (
                                    <article key={user.id} className={`emp-card p-[14px] ${user.is_active ? '' : 'emp-row-off'}`}>
                                        <div className="flex items-start gap-2.5">
                                            <span
                                                aria-hidden="true"
                                                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12px]"
                                                style={{ backgroundColor: `${color}22`, color }}
                                            >
                                                {initialsOf(user)}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={route('users.show', user.id)}
                                                    className="block truncate text-[14px]"
                                                    style={{ color: 'var(--emp-text)' }}
                                                >
                                                    {user.full_name}
                                                </Link>
                                                <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                                                    {user.email}
                                                </p>
                                            </div>

                                            <Can permission="users.edit.permission_overrides">
                                                <button
                                                    type="button"
                                                    onClick={() => setPermissionsFor(user.id)}
                                                    aria-label={`Asignar permisos a ${user.full_name}`}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                                                    style={{ color: 'var(--emp-accent-on)' }}
                                                >
                                                    <ShieldCheck size={18} />
                                                </button>
                                            </Can>
                                        </div>

                                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                            <RoleBadge role={role} />
                                            <span className="emp-pill">
                                                {formatNumber(user.permissions_count)} permisos
                                            </span>
                                            {user.extra_count > 0 ? (
                                                <span className="emp-pill emp-pill-accent">+{user.extra_count} extra</span>
                                            ) : null}
                                            {user.missing_count > 0 ? (
                                                <span className="emp-pill emp-pill-warn">−{user.missing_count}</span>
                                            ) : null}
                                            {! user.is_active ? <span className="emp-pill emp-pill-warn">Inactivo</span> : null}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ----------------------------------------------- paginacion */}
                {rows.length > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(users.from ?? 0)}–{formatNumber(users.to ?? 0)} de{' '}
                            {formatNumber(users.total ?? rows.length)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {users.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === users.links.length - 1;

                                return (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        aria-label={isPrev ? 'Página anterior' : isNext ? 'Página siguiente' : undefined}
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
                    </div>
                ) : null}
            </div>

            {/* Movil: crear siempre a mano. */}
            <Can permission="users.index.create">
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <Link href={route('users.create')} className="emp-btn emp-btn-primary w-full">
                        <Plus size={17} />
                        Nuevo usuario
                    </Link>
                </div>
            </Can>

            <PermissionAssignerModal userId={permissionsFor} onClose={() => setPermissionsFor(null)} />

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (! confirmDelete) return;
                    router.delete(route('users.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar usuario"
                message={`Eliminar a «${confirmDelete?.full_name}»? Esta accion no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
