import { forwardRef, InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
    error?: string;
    containerClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, description, error, className, containerClassName, id, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;

        return (
            <div className={cn('w-full', containerClassName)}>
                <div className="flex items-start gap-2.5">
                    <input
                        ref={ref}
                        id={inputId}
                        type="checkbox"
                        className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600',
                            'focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-800',
                            props.disabled && 'cursor-not-allowed opacity-60',
                            className,
                        )}
                        {...props}
                    />
                    {(label || description) && (
                        <div className="min-w-0">
                            {label && (
                                <label
                                    htmlFor={inputId}
                                    className="block cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300"
                                >
                                    {label}
                                </label>
                            )}
                            {description && (
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                            )}
                        </div>
                    )}
                </div>
                {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            </div>
        );
    },
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
