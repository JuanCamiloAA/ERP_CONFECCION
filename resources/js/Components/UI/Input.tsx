import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
    label?: string;
    error?: string;
    description?: string;
    prefix?: ReactNode;
    suffix?: ReactNode;
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, description, prefix, suffix, className, containerClassName, id, required, ...props }, ref) => {
        const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

        return (
            <div className={cn('w-full', containerClassName)}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        {label}
                        {required && <span className="ml-0.5 text-rose-500">*</span>}
                    </label>
                )}
                <div
                    className={cn(
                        'relative flex items-center overflow-hidden rounded-lg border bg-white transition-colors',
                        'border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20',
                        'dark:bg-slate-800 dark:border-slate-700 dark:focus-within:border-indigo-400',
                        error && 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20',
                        props.disabled && 'bg-slate-50 dark:bg-slate-900 opacity-60',
                    )}
                >
                    {prefix && (
                        <span className="flex h-10 items-center pl-3 text-slate-400 dark:text-slate-500">
                            {prefix}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        required={required}
                        className={cn(
                            'flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400',
                            'dark:text-slate-100 dark:placeholder:text-slate-500',
                            prefix && 'pl-2',
                            suffix && 'pr-2',
                            className,
                        )}
                        {...props}
                    />
                    {suffix && (
                        <span className="flex h-10 items-center pr-3 text-slate-400 dark:text-slate-500">
                            {suffix}
                        </span>
                    )}
                </div>
                {description && !error && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
                {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            </div>
        );
    },
);

Input.displayName = 'Input';

export default Input;
