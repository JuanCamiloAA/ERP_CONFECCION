import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface SearchInputProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    delay?: number;
    className?: string;
}

export function SearchInput({
    value: controlled,
    onChange,
    placeholder = 'Buscar...',
    delay = 300,
    className,
}: SearchInputProps) {
    const [internal, setInternal] = useState(controlled ?? '');
    const debounced = useDebounce(internal, delay);

    useEffect(() => {
        if (debounced !== controlled) {
            onChange(debounced);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    useEffect(() => {
        if (controlled !== undefined && controlled !== internal) {
            setInternal(controlled);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlled]);

    return (
        <div className={cn('relative', className)}>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            </div>
            <input
                type="text"
                value={internal}
                onChange={(e) => setInternal(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    'h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition-colors',
                    'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                    'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
                    'placeholder:text-slate-400',
                )}
            />
            {internal && (
                <button
                    type="button"
                    onClick={() => setInternal('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

export default SearchInput;
