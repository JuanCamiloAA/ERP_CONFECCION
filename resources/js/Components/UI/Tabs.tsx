import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
    key: string;
    label: ReactNode;
    icon?: ReactNode;
    badge?: ReactNode;
    hidden?: boolean;
}

interface TabsProps {
    tabs: Tab[];
    active: string;
    onChange: (key: string) => void;
    className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
    return (
        <div className={cn('border-b border-slate-200 dark:border-slate-700', className)}>
            <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
                {tabs
                    .filter((tab) => !tab.hidden)
                    .map((tab) => {
                        const isActive = active === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => onChange(tab.key)}
                                className={cn(
                                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200',
                                )}
                            >
                                {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                                {tab.label}
                                {tab.badge}
                            </button>
                        );
                    })}
            </nav>
        </div>
    );
}

export default Tabs;
