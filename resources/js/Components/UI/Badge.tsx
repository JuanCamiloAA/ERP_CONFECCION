import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
type Size = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
    children: ReactNode;
    color?: string;
}

const variants: Record<Variant, string> = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    primary: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const sizes: Record<Size, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
};

export function Badge({ variant = 'neutral', size = 'sm', className, children, color, style, ...props }: BadgeProps) {
    const customColorStyle = color
        ? {
              backgroundColor: `${color}20`,
              color,
              ...style,
          }
        : style;

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full font-medium',
                !color && variants[variant],
                sizes[size],
                className,
            )}
            style={customColorStyle}
            {...props}
        >
            {children}
        </span>
    );
}

export default Badge;
