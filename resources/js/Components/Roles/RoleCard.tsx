import { Link } from '@inertiajs/react';
import {
    Eye,
    Lock,
    PencilSimple,
    ShieldCheck,
    Trash,
    UserGear,
    Users,
    UsersThree,
    Wrench,
} from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import { formatNumber } from '@/lib/utils';

export interface RoleAvatar {
    id: number;
    name: string;
    initials: string;
    avatar: string | null;
}

export interface RoleRow {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company_id: number | null;
    permissions_count: number;
    permissions_total: number;
    users_count: number;
    modules: { key: string; display: string }[];
    avatars: RoleAvatar[];
}

/** Un icono por familia de rol; el genérico cubre los roles propios de cada empresa. */
const ROLE_ICONS: Record<string, typeof ShieldCheck> = {
    super_admin: ShieldCheck,
    admin: UserGear,
    supervisor_produccion: Wrench,
    auxiliar_contable: Users,
};

interface Props {
    role: RoleRow;
    onDelete: (role: RoleRow) => void;
}

/**
 * Un rol del listado.
 *
 * La tabla anterior decía el nombre y poco más: para saber si un rol servía había que
 * abrirlo. Aquí se ve de un vistazo cuánto del catálogo cubre, sobre qué áreas manda y
 * quién lo está usando —y ese «quién» lleva directo al listado de usuarios ya filtrado.
 */
export function RoleCard({ role, onDelete }: Props) {
    const Icon = ROLE_ICONS[role.name] ?? UsersThree;
    const percent =
        role.permissions_total > 0 ? Math.round((role.permissions_count / role.permissions_total) * 100) : 0;

    return (
        <article className="emp-card p-4" style={{ borderTop: `2px solid ${role.color}` }}>
            <div className="flex items-start gap-2.5">
                <span
                    aria-hidden="true"
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]"
                    style={{ backgroundColor: `${role.color}22`, color: role.color }}
                >
                    <Icon size={16} />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]" style={{ color: 'var(--emp-text)' }}>
                        {role.display_name}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5">
                        <span
                            className="truncate text-[11.5px]"
                            style={{ color: 'var(--emp-subtle)', fontFamily: 'ui-monospace, monospace' }}
                        >
                            {role.name}
                        </span>
                        {role.is_system ? (
                            <span className="emp-pill shrink-0">
                                <Lock size={10} />
                                Sistema
                            </span>
                        ) : null}
                    </p>
                </div>
            </div>

            <p
                className="mt-2.5 text-[12.5px]"
                style={{ color: 'var(--emp-muted)', minHeight: '38px' }}
            >
                {role.description || 'Sin descripción.'}
            </p>

            {/* ------------------------------------------------------ cobertura */}
            <div className="mt-2">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                        {formatNumber(role.permissions_count)} de {formatNumber(role.permissions_total)} permisos
                    </span>
                    <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                        {percent}%
                    </span>
                </div>
                <div
                    aria-hidden="true"
                    className="mt-1 h-1 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--emp-row)' }}
                >
                    <span
                        className="block h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: role.color }}
                    />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {role.modules.slice(0, 3).map((module) => (
                        <span key={module.key} className="emp-pill">
                            {module.display}
                        </span>
                    ))}
                    {role.modules.length > 3 ? (
                        <span className="emp-pill">+{role.modules.length - 3}</span>
                    ) : null}
                    {role.modules.length === 0 ? (
                        <span className="emp-pill" style={{ color: 'var(--emp-faint)' }}>
                            Sin permisos
                        </span>
                    ) : null}
                </div>
            </div>

            {/* ------------------------------------------------------------ pie */}
            <div
                className="mt-3 flex items-center justify-between gap-2 pt-3"
                style={{ borderTop: '1px solid var(--emp-row)' }}
            >
                <Link
                    href={route('users.index', { role_id: role.id })}
                    className="flex min-w-0 items-center gap-2"
                    aria-label={`Ver los ${role.users_count} usuarios con el rol ${role.display_name}`}
                >
                    <span className="flex shrink-0 items-center">
                        {role.avatars.map((user, index) => (
                            <span
                                key={user.id}
                                title={user.name}
                                className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px]"
                                style={{
                                    marginLeft: index === 0 ? 0 : '-6px',
                                    border: '1.5px solid var(--emp-surface)',
                                    backgroundColor: `${role.color}22`,
                                    color: role.color,
                                }}
                            >
                                {user.initials}
                            </span>
                        ))}
                    </span>
                    <span className="truncate text-[12px]" style={{ color: 'var(--emp-accent-on)' }}>
                        {formatNumber(role.users_count)} {role.users_count === 1 ? 'usuario' : 'usuarios'}
                    </span>
                </Link>

                <div className="flex shrink-0 items-center gap-0.5">
                    <Link
                        href={route('roles.show', role.id)}
                        aria-label={`Ver ${role.display_name}`}
                        className="emp-hover-row flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ color: 'var(--emp-muted)' }}
                    >
                        <Eye size={15} />
                    </Link>

                    {! role.is_system ? (
                        <Can permission="roles.index.edit">
                            <Link
                                href={route('roles.edit', role.id)}
                                aria-label={`Editar ${role.display_name}`}
                                className="emp-hover-row flex h-8 w-8 items-center justify-center rounded-lg"
                                style={{ color: 'var(--emp-muted)' }}
                            >
                                <PencilSimple size={15} />
                            </Link>
                        </Can>
                    ) : null}

                    {! role.is_system ? (
                        <Can permission="roles.index.delete">
                            <button
                                type="button"
                                onClick={() => onDelete(role)}
                                aria-label={`Eliminar ${role.display_name}`}
                                className="emp-hover-row flex h-8 w-8 items-center justify-center rounded-lg"
                                style={{ color: 'var(--emp-danger)' }}
                            >
                                <Trash size={15} />
                            </button>
                        </Can>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default RoleCard;
