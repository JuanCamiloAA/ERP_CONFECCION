import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
    forwardRef,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import type { SelectOption } from '@/types';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    label?: string;
    error?: string;
    description?: string;
    options: SelectOption[];
    placeholder?: string;
    /** Muestra campo de filtro en el desplegable (por defecto true). */
    searchable?: boolean;
}

const triggerBase = cn(
    'relative w-full rounded-lg border bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition-colors',
    'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
    'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:focus:border-indigo-400',
    'flex items-center justify-between gap-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
);

function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number | undefined] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState<number | undefined>();

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) {
            return;
        }

        const update = () => setWidth(el.getBoundingClientRect().width);

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => ro.disconnect();
    }, []);

    return [ref, width];
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
    (
        {
            label,
            error,
            description,
            options,
            placeholder,
            className,
            id,
            required,
            disabled,
            value,
            onChange,
            searchable = true,
            name,
            form,
            autoFocus,
            tabIndex,
        },
        ref,
    ) => {
        const selectId = id || `select-${Math.random().toString(36).slice(2)}`;
        const [query, setQuery] = useState('');
        const [containerRef, panelWidth] = useContainerWidth<HTMLDivElement>();

        const setButtonRef = useCallback(
            (node: HTMLButtonElement | null) => {
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref) {
                    ref.current = node;
                }
            },
            [ref],
        );

        const allOptions = useMemo((): SelectOption[] => {
            if (placeholder !== undefined && placeholder !== null && placeholder !== '') {
                return [{ value: '', label: placeholder }, ...options];
            }
            return options;
        }, [options, placeholder]);

        const selectedOption = useMemo((): SelectOption | undefined => {
            const v = value === undefined || value === null ? '' : String(value);
            return allOptions.find((o) => String(o.value) === v);
        }, [value, allOptions]);

        const filteredOptions = useMemo(() => {
            const q = query.trim().toLowerCase();
            if (!searchable || !q) {
                return allOptions;
            }
            return allOptions.filter((o) => {
                const labelL = String(o.label).toLowerCase();
                const descL = String(o.description ?? '').toLowerCase();
                const valL = String(o.value).toLowerCase();
                return labelL.includes(q) || descL.includes(q) || valL.includes(q);
            });
        }, [allOptions, query, searchable]);

        const fireChange = useCallback(
            (opt: SelectOption) => {
                const v = String(opt.value);
                onChange?.({
                    target: { value: v },
                    currentTarget: { value: v },
                } as ChangeEvent<HTMLSelectElement>);
            },
            [onChange],
        );

        const displayLabel = selectedOption?.label ?? (placeholder || 'Seleccionar');

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                        {label}
                        {required && <span className="ml-0.5 text-rose-500">*</span>}
                    </label>
                )}
                <Listbox
                    value={selectedOption ?? undefined}
                    onChange={(opt) => {
                        if (opt) {
                            fireChange(opt);
                        }
                        setQuery('');
                    }}
                    by={(a, b) => {
                        if (a == null || b == null) {
                            return false;
                        }
                        return String(a.value) === String(b.value);
                    }}
                    disabled={disabled}
                    form={form}
                    name={name}
                >
                    <div ref={containerRef} className="relative w-full">
                        <ListboxButton
                            ref={setButtonRef}
                            id={selectId}
                            autoFocus={autoFocus}
                            tabIndex={tabIndex}
                            className={cn(
                                triggerBase,
                                error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
                                className,
                            )}
                            aria-invalid={Boolean(error)}
                            aria-required={required}
                            data-slot="select-trigger"
                        >
                            <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-slate-500 dark:text-slate-400')}>
                                {displayLabel}
                            </span>
                            <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                        </ListboxButton>

                        <ListboxOptions
                            modal={false}
                            portal
                            anchor="bottom start"
                            transition
                            style={panelWidth ? { width: panelWidth } : undefined}
                            className={cn(
                                'z-[200] mt-1 max-h-72 overflow-hidden rounded-lg border',
                                'border-slate-200 bg-white py-1 shadow-lg outline-none',
                                'dark:border-slate-600 dark:bg-slate-800',
                                'origin-top transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0',
                            )}
                        >
                            {searchable && (
                                <div
                                    className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 pb-2 pt-2 dark:border-slate-600 dark:bg-slate-800"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            className={cn(
                                                'w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-900 outline-none',
                                                'placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
                                                'dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400',
                                            )}
                                            placeholder="Buscar..."
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            autoComplete="off"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') return;
                                                e.stopPropagation();
                                            }}
                                            aria-label="Filtrar opciones"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="max-h-52 overflow-y-auto py-1">
                                {filteredOptions.length === 0 ? (
                                    <p className="px-3 py-2 text-center text-sm text-slate-500 dark:text-slate-400">Sin resultados</p>
                                ) : (
                                    filteredOptions.map((option) => (
                                        <ListboxOption
                                            key={`${String(option.value)}-${option.label}`}
                                            value={option}
                                            className={cn(
                                                'cursor-pointer px-3 py-2 text-sm text-slate-900',
                                                'data-focus:bg-indigo-50 data-selected:font-medium data-focus:dark:bg-slate-700/80',
                                                'dark:text-slate-100',
                                            )}
                                        >
                                            <span className="block truncate">{option.label}</span>
                                            {option.description ? (
                                                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                                    {option.description}
                                                </span>
                                            ) : null}
                                        </ListboxOption>
                                    ))
                                )}
                            </div>
                        </ListboxOptions>
                    </div>
                </Listbox>
                {description && !error && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                )}
                {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
            </div>
        );
    },
);

Select.displayName = 'Select';

export default Select;
