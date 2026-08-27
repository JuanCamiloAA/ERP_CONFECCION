import { CaretDown, Check } from '@phosphor-icons/react';
import { useState } from 'react';
import type { CompanyRow, RoleRow, VisibilityPair } from '@/Components/DashboardBuilder/VisibilityMatrix';
import { formatNumber } from '@/lib/utils';

interface Props {
    companies: CompanyRow[];
    rolesByCompany: Record<string, RoleRow[]>;
    rows: VisibilityPair[];
    onToggleAll: (companyId: number) => void;
    onToggleRole: (companyId: number, roleId: number) => void;
    disabled: boolean;
}

/**
 * Visibilidad en móvil.
 *
 * La matriz no cabe en un teléfono, así que cada empresa se despliega y sus roles pasan a
 * ser chips de 44 px. El estado es el mismo que el de escritorio: lo que se marque aquí
 * viaja en el mismo `PUT`.
 */
export function VisibilitySheet({ companies, rolesByCompany, rows, onToggleAll, onToggleRole, disabled }: Props) {
    const [open, setOpen] = useState<number | null>(null);

    const isAllRoles = (companyId: number) => rows.some((r) => r.company_id === companyId && r.role_id === null);
    const isRole = (companyId: number, roleId: number) =>
        rows.some((r) => r.company_id === companyId && r.role_id === roleId);

    return (
        <div className="flex flex-col gap-2">
            {companies.map((company) => {
                const companyRoles = rolesByCompany[String(company.id)] ?? [];
                const allRoles = isAllRoles(company.id);
                const marked = rows.filter((r) => r.company_id === company.id && r.role_id !== null).length;
                const expanded = open === company.id;

                return (
                    <article
                        key={company.id}
                        className={`overflow-hidden rounded-[14px] ${company.is_active ? '' : 'emp-row-off'}`}
                        style={{
                            border: `1px solid ${expanded ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                            backgroundColor: 'var(--emp-surface)',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setOpen(expanded ? null : company.id)}
                            aria-expanded={expanded}
                            className="flex w-full items-center gap-3 p-3 text-left"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                        {company.name}
                                    </span>
                                    {! company.is_active ? (
                                        <span className="emp-pill emp-pill-warn">Inactiva</span>
                                    ) : null}
                                </span>
                                <span
                                    className="mt-0.5 block text-[11.5px]"
                                    style={{ color: allRoles ? 'var(--emp-accent-on)' : 'var(--emp-subtle)' }}
                                >
                                    {allRoles
                                        ? 'Todos los roles'
                                        : `${marked} ${marked === 1 ? 'rol marcado' : 'roles marcados'} de ${formatNumber(
                                              companyRoles.length,
                                          )}`}
                                </span>
                            </span>

                            <CaretDown
                                size={14}
                                style={{
                                    color: 'var(--emp-subtle)',
                                    transform: expanded ? 'rotate(180deg)' : undefined,
                                    transition: 'transform 120ms ease-out',
                                }}
                            />
                        </button>

                        {expanded ? (
                            <div
                                className="p-3"
                                style={{
                                    backgroundColor: 'var(--emp-field-alt)',
                                    borderTop: '1px solid var(--emp-border)',
                                }}
                            >
                                <label
                                    className="flex h-12 cursor-pointer items-center gap-2.5 rounded-[10px] px-3"
                                    style={{
                                        border: `1px solid ${allRoles ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                        backgroundColor: allRoles ? 'var(--emp-accent-fill)' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={allRoles}
                                        disabled={disabled}
                                        onChange={() => onToggleAll(company.id)}
                                        aria-label={`Todos los roles en ${company.name}`}
                                        className="h-5 w-5 rounded"
                                        style={{ accentColor: 'var(--emp-accent)' }}
                                    />
                                    <span
                                        className="text-[13px]"
                                        style={{ color: allRoles ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                                    >
                                        Todos los roles
                                    </span>
                                </label>

                                {companyRoles.length === 0 ? (
                                    <p className="mt-2.5 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                        Esta empresa todavía no tiene roles.
                                    </p>
                                ) : (
                                    <div className="mt-2.5 flex flex-wrap gap-2">
                                        {companyRoles.map((role) => {
                                            const active = isRole(company.id, role.id);

                                            return (
                                                <button
                                                    key={role.id}
                                                    type="button"
                                                    onClick={() => onToggleRole(company.id, role.id)}
                                                    disabled={disabled || allRoles}
                                                    aria-pressed={active}
                                                    aria-label={`${role.display_name || role.name} en ${company.name}`}
                                                    className="inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-[13px] disabled:opacity-45"
                                                    style={{
                                                        border: `1px solid ${active ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                                        backgroundColor: active ? 'var(--emp-accent-fill)' : 'transparent',
                                                        color: active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                                    }}
                                                >
                                                    {active ? <Check size={13} /> : null}
                                                    {role.display_name || role.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </article>
                );
            })}
        </div>
    );
}

export default VisibilitySheet;
