import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PermissionMatrix as MatrixType } from '@/types';

const allActions = ['view', 'create', 'edit', 'delete', 'export'] as const;
const specialActions = ['calculate', 'approve', 'pay'] as const;

const actionLabels: Record<string, string> = {
    view: 'Ver',
    create: 'Crear',
    edit: 'Editar',
    delete: 'Eliminar',
    export: 'Exportar',
    calculate: 'Calcular',
    approve: 'Aprobar',
    pay: 'Pagar',
};

interface PermissionMatrixProps {
    matrix: MatrixType;
    value: string[];
    onChange: (selected: string[]) => void;
    readonly?: boolean;
}

export function PermissionMatrix({ matrix, value, onChange, readonly = false }: PermissionMatrixProps) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(Object.keys(matrix).map((k) => [k, true])),
    );

    const valueSet = useMemo(() => new Set(value), [value]);
    const totalSelected = valueSet.size;

    const toggle = (perm: string) => {
        if (readonly) return;
        const next = new Set(valueSet);
        if (next.has(perm)) {
            next.delete(perm);
        } else {
            next.add(perm);
            if (!perm.endsWith('.view')) {
                const parts = perm.split('.');
                next.add(`${parts[0]}.${parts[1]}.view`);
            }
        }
        onChange(Array.from(next));
    };

    const toggleAllInModule = (moduleKey: string) => {
        if (readonly) return;
        const moduleConf = matrix[moduleKey];
        const all: string[] = [];
        for (const [page, pageConf] of Object.entries(moduleConf.pages)) {
            for (const action of pageConf.actions) {
                all.push(`${moduleKey}.${page}.${action}`);
            }
        }

        const next = new Set(valueSet);
        const hasAll = all.every((p) => next.has(p));
        if (hasAll) {
            all.forEach((p) => next.delete(p));
        } else {
            all.forEach((p) => next.add(p));
        }
        onChange(Array.from(next));
    };

    const toggleAllInColumn = (action: string) => {
        if (readonly) return;
        const all: string[] = [];
        for (const [moduleKey, moduleConf] of Object.entries(matrix)) {
            for (const [page, pageConf] of Object.entries(moduleConf.pages)) {
                if (pageConf.actions.includes(action)) {
                    all.push(`${moduleKey}.${page}.${action}`);
                }
            }
        }

        const next = new Set(valueSet);
        const hasAll = all.every((p) => next.has(p));
        if (hasAll) {
            all.forEach((p) => next.delete(p));
        } else {
            all.forEach((p) => {
                next.add(p);
                if (action !== 'view') {
                    const [m, pg] = p.split('.');
                    next.add(`${m}.${pg}.view`);
                }
            });
        }
        onChange(Array.from(next));
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Matriz de Permisos
                </p>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {totalSelected} seleccionados
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                                Modulo / Pagina
                            </th>
                            {allActions.map((action) => (
                                <th key={action} className="px-3 py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => toggleAllInColumn(action)}
                                        disabled={readonly}
                                        className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400"
                                    >
                                        {actionLabels[action]}
                                    </button>
                                </th>
                            ))}
                            <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                Especial
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(matrix).map(([moduleKey, moduleConf]) => {
                            const isExpanded = expanded[moduleKey] ?? true;
                            const moduleAllPerms: string[] = [];
                            for (const [page, pageConf] of Object.entries(moduleConf.pages)) {
                                for (const action of pageConf.actions) {
                                    moduleAllPerms.push(`${moduleKey}.${page}.${action}`);
                                }
                            }
                            const moduleSelectedCount = moduleAllPerms.filter((p) => valueSet.has(p)).length;
                            const moduleAllSelected = moduleSelectedCount > 0 && moduleSelectedCount === moduleAllPerms.length;

                            return (
                                <>
                                    <tr key={`mod-${moduleKey}`} className="bg-slate-100/70 dark:bg-slate-700/50">
                                        <td className="sticky left-0 bg-slate-100/70 px-4 py-2 dark:bg-slate-700/50">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded((e) => ({ ...e, [moduleKey]: !isExpanded }))}
                                                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                >
                                                    <ChevronDownIcon
                                                        className={cn('h-4 w-4 transition-transform', !isExpanded && '-rotate-90')}
                                                    />
                                                </button>
                                                <input
                                                    type="checkbox"
                                                    checked={moduleAllSelected}
                                                    onChange={() => toggleAllInModule(moduleKey)}
                                                    disabled={readonly}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                                />
                                                <span className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                                                    {moduleConf.display}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    ({moduleSelectedCount}/{moduleAllPerms.length})
                                                </span>
                                            </div>
                                        </td>
                                        <td colSpan={6} />
                                    </tr>

                                    {isExpanded &&
                                        Object.entries(moduleConf.pages).map(([page, pageConf]) => (
                                            <tr key={`${moduleKey}-${page}`} className="border-t border-slate-100 dark:border-slate-700/50">
                                                <td className="sticky left-0 bg-white px-4 py-2 pl-12 dark:bg-slate-800">
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                                        {pageConf.display}
                                                    </span>
                                                </td>
                                                {allActions.map((action) => {
                                                    if (!pageConf.actions.includes(action)) {
                                                        return <td key={action} className="px-3 py-2 text-center text-slate-300 dark:text-slate-600">—</td>;
                                                    }
                                                    const perm = `${moduleKey}.${page}.${action}`;
                                                    const checked = valueSet.has(perm);
                                                    return (
                                                        <td key={action} className="px-3 py-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggle(perm)}
                                                                disabled={readonly}
                                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                                            />
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {specialActions.map((action) => {
                                                            if (!pageConf.actions.includes(action)) return null;
                                                            const perm = `${moduleKey}.${page}.${action}`;
                                                            const checked = valueSet.has(perm);
                                                            return (
                                                                <label key={action} className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => toggle(perm)}
                                                                        disabled={readonly}
                                                                        className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                                                                    />
                                                                    {actionLabels[action]}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
