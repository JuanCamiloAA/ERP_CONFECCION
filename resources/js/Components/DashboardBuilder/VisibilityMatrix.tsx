import { useMemo } from 'react';
import { formatNumber } from '@/lib/utils';

export interface CompanyRow {
    id: number;
    name: string;
    nit?: string | null;
    is_active: boolean;
    users_count?: number;
}

export interface RoleRow {
    id: number;
    company_id: number;
    name: string;
    display_name: string;
}

export interface VisibilityPair {
    company_id: number;
    role_id: number | null;
}

/** Sin roles no hay columnas; con muchas, la matriz se desplaza y la empresa se queda fija. */
export const MAX_ROLES_WITHOUT_SCROLL = 6;

interface Props {
    companies: CompanyRow[];
    rolesByCompany: Record<string, RoleRow[]>;
    rows: VisibilityPair[];
    onToggleAll: (companyId: number) => void;
    onToggleRole: (companyId: number, roleId: number) => void;
    disabled: boolean;
}

/**
 * Abrevia el rótulo de una columna sin partir la palabra por la mitad.
 * El nombre completo sigue en el `title` y en el `aria-label` de cada casilla.
 */
export function abbreviate(label: string, max = 11): string {
    if (label.length <= max) return label;

    const words = label.split(/\s+/);
    if (words.length > 1) {
        return words.map((word) => (word.length > 4 ? `${word.slice(0, 4)}.` : word)).join(' ');
    }

    return `${label.slice(0, max - 1)}.`;
}

/**
 * Matriz empresa × rol.
 *
 * Antes era una tarjeta por empresa con las casillas apiladas: para responder «¿qué
 * empresas ven esto con el rol Contador?» había que recorrer seis tarjetas. Los roles son
 * de cada empresa, así que las columnas se arman con la unión de nombres de rol y cada
 * celda usa el rol que esa empresa tiene con ese nombre; donde una empresa no tenga el
 * rol, la celda queda vacía en vez de mentir con una casilla que no existe.
 */
export function VisibilityMatrix({ companies, rolesByCompany, rows, onToggleAll, onToggleRole, disabled }: Props) {
    const roleColumns = useMemo(() => {
        const byName = new Map<string, string>();

        companies.forEach((company) => {
            (rolesByCompany[String(company.id)] ?? []).forEach((role) => {
                if (! byName.has(role.name)) {
                    byName.set(role.name, role.display_name || role.name);
                }
            });
        });

        return [...byName.entries()]
            .map(([name, label]) => ({ name, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    }, [companies, rolesByCompany]);

    const isAllRoles = (companyId: number) => rows.some((r) => r.company_id === companyId && r.role_id === null);
    const isRole = (companyId: number, roleId: number) =>
        rows.some((r) => r.company_id === companyId && r.role_id === roleId);

    const grid = `minmax(240px,1fr) 92px repeat(${roleColumns.length}, 76px)`;
    const needsScroll = roleColumns.length > MAX_ROLES_WITHOUT_SCROLL;

    return (
        <div className={needsScroll ? 'overflow-x-auto' : ''}>
            <div style={{ minWidth: needsScroll ? `${340 + roleColumns.length * 76}px` : undefined }}>
                {/* ------------------------------------------------ cabecera */}
                <div
                    className="grid items-end gap-0 pb-2"
                    style={{ gridTemplateColumns: grid, borderBottom: '1px solid var(--emp-border)' }}
                >
                    <span
                        className="px-3 text-[11px] uppercase tracking-[0.09em]"
                        style={{
                            color: 'var(--emp-subtle)',
                            position: needsScroll ? 'sticky' : undefined,
                            left: 0,
                            backgroundColor: needsScroll ? 'var(--emp-bg)' : undefined,
                        }}
                    >
                        Empresa
                    </span>
                    <span
                        className="text-center text-[11px] uppercase tracking-[0.09em]"
                        style={{ color: 'var(--emp-accent-on)' }}
                    >
                        Todos
                    </span>
                    {roleColumns.map((column) => (
                        <span
                            key={column.name}
                            title={column.label}
                            className="text-center text-[11px] uppercase tracking-[0.09em]"
                            style={{ color: 'var(--emp-subtle)' }}
                        >
                            {abbreviate(column.label)}
                        </span>
                    ))}
                </div>

                {/* --------------------------------------------------- filas */}
                {companies.map((company) => {
                    const companyRoles = rolesByCompany[String(company.id)] ?? [];
                    const allRoles = isAllRoles(company.id);
                    const marked = rows.filter((r) => r.company_id === company.id && r.role_id !== null).length;

                    return (
                        <div
                            key={company.id}
                            className={`emp-row-sep grid items-center gap-0 ${company.is_active ? '' : 'emp-row-off'}`}
                            style={{
                                gridTemplateColumns: grid,
                                ...(allRoles
                                    ? {
                                          backgroundColor: 'var(--emp-row-hover)',
                                          boxShadow: 'inset 2px 0 0 var(--emp-accent-line)',
                                      }
                                    : {}),
                            }}
                        >
                            <div
                                className="min-w-0 px-3 py-2.5"
                                style={{
                                    position: needsScroll ? 'sticky' : undefined,
                                    left: 0,
                                    backgroundColor: needsScroll ? 'var(--emp-surface)' : undefined,
                                }}
                            >
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {/* Sin elipsis: el nombre completo cabe en dos líneas. */}
                                    <span className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                        {company.name}
                                    </span>
                                    {! company.is_active ? <span className="emp-pill emp-pill-warn">Inactiva</span> : null}
                                </div>
                                <p
                                    className="mt-0.5 text-[11.5px]"
                                    style={{ color: allRoles ? 'var(--emp-accent-on)' : 'var(--emp-subtle)' }}
                                >
                                    {allRoles
                                        ? 'Todos los roles · las marcas por rol quedan desactivadas'
                                        : [
                                              company.nit ? `NIT ${company.nit}` : null,
                                              company.users_count != null
                                                  ? `${formatNumber(company.users_count)} ${
                                                        company.users_count === 1 ? 'usuario' : 'usuarios'
                                                    }`
                                                  : null,
                                              `${marked} ${marked === 1 ? 'rol marcado' : 'roles marcados'}`,
                                          ]
                                              .filter(Boolean)
                                              .join(' · ')}
                                </p>
                                {! company.is_active ? (
                                    <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                        Suscripción suspendida · no pinta dashboards
                                    </p>
                                ) : null}
                            </div>

                            <label
                                className="flex h-[38px] cursor-pointer items-center justify-center"
                                style={{ backgroundColor: 'transparent' }}
                            >
                                <input
                                    type="checkbox"
                                    checked={allRoles}
                                    disabled={disabled}
                                    onChange={() => onToggleAll(company.id)}
                                    aria-label={`Todos los roles en ${company.name}`}
                                    className="h-4 w-4 rounded"
                                    style={{ accentColor: 'var(--emp-accent)' }}
                                />
                            </label>

                            {roleColumns.map((column) => {
                                const role = companyRoles.find((r) => r.name === column.name);

                                if (! role) {
                                    return (
                                        <span
                                            key={column.name}
                                            aria-hidden="true"
                                            className="flex h-[38px] items-center justify-center text-[12px]"
                                            style={{ color: 'var(--emp-faint)' }}
                                        >
                                            —
                                        </span>
                                    );
                                }

                                return (
                                    <label
                                        key={column.name}
                                        className="emp-hover-row flex h-[38px] cursor-pointer items-center justify-center"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isRole(company.id, role.id)}
                                            disabled={disabled || allRoles}
                                            onChange={() => onToggleRole(company.id, role.id)}
                                            aria-label={`${role.display_name || role.name} en ${company.name}`}
                                            className="h-4 w-4 rounded"
                                            style={{
                                                accentColor: 'var(--emp-accent)',
                                                opacity: allRoles ? 0.45 : 1,
                                            }}
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default VisibilityMatrix;
