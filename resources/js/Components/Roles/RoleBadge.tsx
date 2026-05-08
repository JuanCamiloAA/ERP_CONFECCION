import { cn } from '@/lib/utils';

interface RoleBadgeProps {
    role: { name: string; display_name: string; color?: string | null } | null;
    className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
    if (!role) {
        return (
            <span className={cn('inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300', className)}>
                Sin rol
            </span>
        );
    }

    const color = role.color ?? '#6366f1';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                className,
            )}
            style={{ backgroundColor: `${color}25`, color }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {role.display_name}
        </span>
    );
}
