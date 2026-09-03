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
                        <label className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            {label}
                        </label>
                    )}
                    {description && (
                        <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {description}
                        </p>
                    )}
                </div>
            )}
            <HeadlessSwitch
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                    disabled && 'cursor-not-allowed opacity-50',
                )}
                style={{ backgroundColor: checked ? 'var(--emp-accent)' : 'var(--emp-border)' }}
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
