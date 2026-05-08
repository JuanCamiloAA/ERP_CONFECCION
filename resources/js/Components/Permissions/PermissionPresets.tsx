import { Button } from '@/Components/UI/Button';
import type { PermissionMatrix } from '@/types';

interface PermissionPresetsProps {
    matrix: PermissionMatrix;
    onApply: (permissions: string[]) => void;
}

export function PermissionPresets({ matrix, onApply }: PermissionPresetsProps) {
    const flatten = (filter: (mod: string, page: string, action: string) => boolean): string[] => {
        const list: string[] = [];
        for (const [mod, modConf] of Object.entries(matrix)) {
            if (modConf.super_admin_only) continue;
            for (const [page, pageConf] of Object.entries(modConf.pages)) {
                for (const action of pageConf.actions) {
                    if (filter(mod, page, action)) {
                        list.push(`${mod}.${page}.${action}`);
                    }
                }
            }
        }
        return list;
    };

    const presets = [
        {
            label: 'Solo lectura',
            description: 'Solo permisos de ver',
            apply: () => onApply(flatten((_m, _p, action) => action === 'view')),
        },
        {
            label: 'Operario',
            description: 'Acceso minimo: dashboard y consulta de produccion/nomina',
            apply: () =>
                onApply([
                    'dashboard.index.view',
                    'productions.index.view',
                    'productions.report.view',
                    'payrolls.index.view',
                    'payrolls.show.view',
                ]),
        },
        {
            label: 'Supervisor',
            description: 'Crear y editar produccion, ver empleados, reportes',
            apply: () =>
                onApply(
                    flatten((mod, _p, action) => {
                        if (['users', 'roles', 'settings'].includes(mod)) return false;
                        return !['delete', 'approve', 'pay'].includes(action);
                    }),
                ),
        },
        {
            label: 'Administrador',
            description: 'Todos los permisos del area de negocio',
            apply: () => onApply(flatten(() => true)),
        },
    ];

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Plantillas rapidas
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {presets.map((preset) => (
                    <button
                        key={preset.label}
                        type="button"
                        onClick={preset.apply}
                        className="rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-500 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-indigo-900/30"
                    >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{preset.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
