import { Link } from '@inertiajs/react';
import { Eye, Lock, PencilSimple, Trash } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import type { RoleRow } from '@/Components/Roles/RoleCard';
import { formatNumber } from '@/lib/utils';

export const ROLE_GRID = 'minmax(180px,1.4fr) 96px minmax(120px,1fr) minmax(140px,1.2fr) 108px';

interface Props {
    roles: RoleRow[];
    onDelete: (role: RoleRow) => void;
}

const COLUMNS = [
    { label: 'Rol', right: false },
    { label: 'Usuarios', right: true },
    { label: 'Permisos', right: false },
    { label: 'Áreas', right: false },
    { label: '', right: false },
];

/**
 * Los roles en una linea por rol.
 *
 * Las tarjetas se leen mejor de una en una, pero cuando hay que responder «¿cuál de estos
 * cinco roles cubre más?» hacen falta las cifras en columna, una debajo de otra.
 */
export function RoleTable({ roles, onDelete }: Props) {
    return (
        <div>
            <div
                className="grid items-center gap-2.5 px-3 pb-2"
                style={{ gridTemplateColumns: ROLE_GRID, borderBottom: '1px solid var(--emp-border)' }}
            >
                {COLUMNS.map((column, index) => (
                    <span
                        key={column.label || `col-${index}`}
                        className={`emp-kicker ${column.right ? 'text-right' : ''}`}
                    >
                        {column.label}
                    </span>
                ))}
            </div>

            {roles.map((role) => {
                const coverage =
                    role.permissions_total > 0
                        ? Math.round((role.permissions_count / role.permissions_total) * 100)
                        : 0;

                return (
                    <div
                        key={role.id}
                        className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5"
                        style={{ gridTemplateColumns: ROLE_GRID }}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span
                                aria-hidden="true"
                                className="h-[26px] w-[3px] shrink-0 rounded-full"
                                style={{ backgroundColor: role.color }}
                            />
                            <div className="min-w-0">
                                <p className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                    <span className="truncate">{role.display_name}</span>
                                    {role.is_system ? (
                                        <Lock
                                            size={12}
                                            aria-label="Rol del sistema"
                                            style={{ color: 'var(--emp-subtle)', flexShrink: 0 }}
                                        />
                                    ) : null}
                                </p>
                                <p className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    {role.description || role.name}
                                </p>
                            </div>
                        </div>

                        <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {formatNumber(role.users_count)}
                        </span>

                        <div className="min-w-0">
                            <p className="text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                {formatNumber(role.permissions_count)} / {formatNumber(role.permissions_total)}
                            </p>
                            <div
                                className="mt-1 h-1 overflow-hidden rounded-full"
                                role="progressbar"
                                aria-valuenow={coverage}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Cobertura de ${role.display_name}`}
                                style={{ backgroundColor: 'var(--emp-field-alt)' }}
                            >
                                <span
                                    className="block h-full rounded-full"
                                    style={{ width: `${coverage}%`, backgroundColor: 'var(--emp-accent)' }}
                                />
                            </div>
                        </div>

                        <p className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            {role.modules.length === 0
                                ? 'Sin áreas'
                                : role.modules.map((module) => module.display).join(', ')}
                        </p>

                        <div className="flex items-center justify-end gap-1">
                            <Link
                                href={route('roles.show', role.id)}
                                aria-label={`Ver ${role.display_name}`}
                                className="emp-btn emp-btn-sm emp-btn-ghost"
                            >
                                <Eye size={14} />
                            </Link>
                            <Can permission="roles.index.edit">
                                <Link
                                    href={route('roles.edit', role.id)}
                                    aria-label={`Editar ${role.display_name}`}
                                    className="emp-btn emp-btn-sm emp-btn-ghost"
                                >
                                    <PencilSimple size={14} />
                                </Link>
                            </Can>
                            {! role.is_system ? (
                                <Can permission="roles.index.delete">
                                    <button
                                        type="button"
                                        onClick={() => onDelete(role)}
                                        aria-label={`Eliminar ${role.display_name}`}
                                        className="emp-btn emp-btn-sm emp-btn-ghost"
                                        style={{ color: 'var(--emp-danger)' }}
                                    >
                                        <Trash size={14} />
                                    </button>
                                </Can>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default RoleTable;
