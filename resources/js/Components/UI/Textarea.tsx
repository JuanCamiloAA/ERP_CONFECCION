import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    description?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, description, className, id, required, ...props }, ref) => {
        const textareaId = id || `textarea-${Math.random().toString(36).slice(2)}`;

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        {label}
                        {required && <span className="ml-0.5 text-rose-500">*</span>}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    required={required}
                    rows={props.rows ?? 4}
                    className={cn(
                        'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors',
                        'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                        'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:focus:border-indigo-400',
                        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                        error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
                        className,
                    )}
                    {...props}
                />
                {description && !error && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
                {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            </div>
        );
    },
);

Textarea.displayName = 'Textarea';

export default Textarea;
