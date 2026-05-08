import { ReactNode } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center',
                'dark:border-slate-700 dark:bg-slate-800/50',
                className,
            )}
        >
            <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                {icon ?? <InboxIcon className="h-8 w-8" />}
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {description && (
                <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export default EmptyState;
