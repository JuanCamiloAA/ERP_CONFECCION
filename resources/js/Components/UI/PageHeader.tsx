import { ReactNode } from 'react';
import { Breadcrumb } from './Breadcrumb';

interface PageHeaderProps {
    title: string;
    description?: string;
    breadcrumbs?: { label: string; href?: string }[];
    action?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
    return (
        <div className="space-y-3">
            {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
                    {description && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                    )}
                </div>
                {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
            </div>
        </div>
    );
}

export default PageHeader;
