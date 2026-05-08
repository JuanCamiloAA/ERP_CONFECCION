import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ className, padding = 'md', children, ...props }: CardProps) {
    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
    };

    return (
        <div
            className={cn(
                'rounded-xl border border-slate-200 bg-white shadow-sm',
                'dark:border-slate-700 dark:bg-slate-800',
                paddings[padding],
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
}

export function CardHeader({ title, description, action, className, children, ...props }: CardHeaderProps) {
    return (
        <div
            className={cn('flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700', className)}
            {...props}
        >
            <div className="flex-1">
                {title && <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
                {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
                {children}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn('pt-4', className)} {...props}>
            {children}
        </div>
    );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700', className)}
            {...props}
        >
            {children}
        </div>
    );
}

export default Card;
