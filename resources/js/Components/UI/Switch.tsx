import { Switch as HeadlessSwitch } from '@headlessui/react';
import { cn } from '@/lib/utils';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            {(label || description) && (
                <div>
                    {label && (
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {label}
                        </label>
                    )}
                    {description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                    )}
                </div>
            )}
            <HeadlessSwitch
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                    checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600',
                    disabled && 'cursor-not-allowed opacity-50',
                )}
            >
                <span
                    className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        checked ? 'translate-x-6' : 'translate-x-1',
                    )}
                />
            </HeadlessSwitch>
        </div>
    );
}

export default Switch;
