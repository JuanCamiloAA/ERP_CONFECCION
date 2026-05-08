import { useMemo, useState } from 'react';
import type { PermissionMatrix as MatrixType } from '@/types';
import { cn } from '@/lib/utils';

export interface OverrideRow {
    permission: string;
    effect: 'grant' | 'deny';
}

interface Props {
    matrix: MatrixType;
    rolePermissions: string[];
    value: OverrideRow[];
    onChange: (payload: OverrideRow[]) => void;
    disabled?: boolean;
}

function isSuperAdminOnly(module: { super_admin_only?: boolean }): boolean {
    return Boolean(module.super_admin_only);
}

export function PermissionOverrideMatrix({
    matrix,
    rolePermissions,
    value,
    onChange,
    disabled = false,
}: Props) {
    const [showAll, setShowAll] = useState(false);

    const extras = useMemo(() => Object.fromEntries(value.map((o) => [o.permission, o.effect])), [value]);

    const roleSet = useMemo(() => new Set(rolePermissions), [rolePermissions]);

    const rows = useMemo(() => {
        const out: { perm: string; label: string }[] = [];
        for (const [moduleKey, moduleConf] of Object.entries(matrix)) {
            if (isSuperAdminOnly(moduleConf)) {
                continue;
            }
            for (const [page, pageConf] of Object.entries(moduleConf.pages)) {
                for (const action of pageConf.actions) {
                    const perm = `${moduleKey}.${page}.${action}`;
                    out.push({
                        perm,
                        label: `${moduleConf.display} — ${pageConf.display} — ${action}`,
                    });
                }
            }
        }
        return out;
    }, [matrix]);

    const setRowEffect = (perm: string, effect: 'inherit' | 'grant' | 'deny') => {
        const map = { ...extras };
        if (effect === 'inherit') {
            delete map[perm];
        } else {
            map[perm] = effect;
        }
        onChange(
            Object.entries(map).map(([permission, eff]) => ({
                permission,
                effect: eff,
            })),
        );
    };

    const visibleRows = useMemo(() => {
        if (showAll) {
            return rows;
        }
        return rows.filter((r) => roleSet.has(r.perm) || extras[r.perm]);
    }, [rows, showAll, roleSet, extras]);

    return (
        <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                    disabled={disabled}
                    className="rounded border-slate-300 dark:border-slate-600"
                />
                Mostrar todos los permisos del catalogo (no solo los del rol)
            </label>
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {visibleRows.map((row) => {
                        const fromRole = roleSet.has(row.perm);
                        const eff = extras[row.perm] ? extras[row.perm]! : ('inherit' as const);
                        return (
                            <li key={row.perm} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                                <p className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">{row.label}</p>
                                <span
                                    className={cn(
                                        'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                                        fromRole ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
                                    )}
                                >
                                    {fromRole ? 'En el rol' : 'Fuera del rol'}
                                </span>
                                <select
                                    value={eff}
                                    onChange={(e) => setRowEffect(row.perm, e.target.value as 'inherit' | 'grant' | 'deny')}
                                    disabled={disabled}
                                    className="h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                >
                                    <option value="inherit">Heredado del rol</option>
                                    <option value="grant">Conceder (excepcion)</option>
                                    <option value="deny">Denegar (excepcion)</option>
                                </select>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
