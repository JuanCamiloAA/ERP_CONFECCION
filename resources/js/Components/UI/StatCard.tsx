import { ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: ReactNode;
    icon?: ReactNode;
    color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
    trend?: {
        value: number;
        label?: string;
    };
    subtitle?: ReactNode;
    onClick?: () => void;
}

const colors: Record<NonNullable<StatCardProps['color']>, { bg: string; text: string }> = {
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-400' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
    rose: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-400' },
    sky: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-600 dark:text-sky-400' },
};

export function StatCard({ title, value, icon, color = 'indigo', trend, subtitle, onClick }: StatCardProps) {
    const palette = colors[color];

    return (
        <div
            onClick={onClick}
            className={cn(
                'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all',
                'dark:border-slate-700 dark:bg-slate-800',
                onClick && 'cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600',
            )}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                    )}
                    {trend && (
                        <div className="mt-3 flex items-center gap-1.5">
                            <span
                                className={cn(
                                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
                                    trend.value >= 0
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                                )}
                            >
                                {trend.value >= 0 ? (
                                    <ArrowUpIcon className="h-3 w-3" />
                                ) : (
                                    <ArrowDownIcon className="h-3 w-3" />
                                )}
                                {Math.abs(trend.value)}%
                            </span>
                            {trend.label && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">{trend.label}</span>
                            )}
                        </div>
                    )}
                </div>
                {icon && (
                    <div
                        className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                            palette.bg,
                            palette.text,
                        )}
                    >
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}

export default StatCard;
