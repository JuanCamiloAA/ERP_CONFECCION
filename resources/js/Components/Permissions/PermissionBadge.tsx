import { cn } from '@/lib/utils';

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

const actionColors: Record<string, string> = {
    view: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    edit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    export: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    calculate: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    approve: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    pay: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

interface PermissionBadgeProps {
    permission: string;
    className?: string;
}

export function PermissionBadge({ permission, className }: PermissionBadgeProps) {
    const parts = permission.split('.');
    const action = parts[parts.length - 1];

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                actionColors[action] ?? 'bg-slate-100 text-slate-700',
                className,
            )}
            title={permission}
        >
            {actionLabels[action] ?? action}
        </span>
    );
}
