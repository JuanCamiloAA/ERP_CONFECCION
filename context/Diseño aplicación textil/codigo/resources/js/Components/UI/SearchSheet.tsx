import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { CheckIcon, MagnifyingGlassIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SearchSheetItem {
    id: number | string;
    /** Titulo principal (ej. "REF-1042 · Camisa Oxford MC"). */
    title: string;
    /** Linea secundaria (ej. "4 operaciones · disponibles 440"). */
    subtitle?: string;
    /** Contenido alineado a la derecha (ej. precio de la operacion). */
    trailing?: ReactNode;
    /** Icono / miniatura a la izquierda. */
    leading?: ReactNode;
    /** Texto extra que tambien se busca (codigo, documento, etc.). */
    keywords?: string;
    disabled?: boolean;
}

interface SearchSheetProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    items: SearchSheetItem[];
    selectedId?: number | string | null;
    onSelect: (id: number | string) => void;
    /** Ids que se muestran arriba bajo "Recientes" (ej. cacheados en localStorage). */
    recentIds?: (number | string)[];
    searchPlaceholder?: string;
    emptyMessage?: string;
    /** Etiqueta del contador; recibe cuantos coinciden y el total. */
    countLabel?: (shown: number, total: number) => string;
}

function normalize(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Hoja inferior con buscador y lista desplazable para elegir un item entre muchos
 * (referencias, operaciones, empleados). Reemplaza a los <select> nativos en movil:
 * soporta cientos de registros sin desbordar y deja los objetivos tactiles en 56px.
 */
export function SearchSheet({
    open,
    onClose,
    title,
    subtitle,
    items,
    selectedId = null,
    onSelect,
    recentIds = [],
    searchPlaceholder = 'Buscar…',
    emptyMessage = 'Sin resultados para tu busqueda.',
    countLabel = (shown, total) => `${shown} de ${total}`,
}: SearchSheetProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
        }
    }, [open]);

    const filtered = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return items;
        return items.filter((item) =>
            normalize(`${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`).includes(q),
        );
    }, [items, query]);

    const recents = useMemo(() => {
        if (query.trim() || recentIds.length === 0) return [];
        return recentIds
            .map((id) => items.find((item) => item.id === id))
            .filter((item): item is SearchSheetItem => Boolean(item))
            .slice(0, 3);
    }, [items, recentIds, query]);

    const recentIdSet = new Set(recents.map((r) => r.id));
    const rest = filtered.filter((item) => !recentIdSet.has(item.id));

    const renderRow = (item: SearchSheetItem) => {
        const isSelected = item.id === selectedId;

        return (
            <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                    onSelect(item.id);
                    onClose();
                }}
                className={cn(
                    'flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left transition-colors',
                    'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:border-slate-700/60 dark:hover:bg-slate-700/30',
                )}
            >
                {item.leading && <span className="shrink-0">{item.leading}</span>}
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                    </span>
                    {item.subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                            {item.subtitle}
                        </span>
                    )}
                </span>
                {item.trailing && <span className="shrink-0 text-[15px] font-semibold tabular-nums">{item.trailing}</span>}
                {isSelected && <CheckIcon className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
            </button>
        );
    };

    return (
        <Transition show={open} as={Fragment} afterEnter={() => inputRef.current?.focus()}>
            <Dialog onClose={onClose} className="relative z-50">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/45" aria-hidden />
                </TransitionChild>

                <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="translate-y-full sm:translate-y-4 sm:opacity-0"
                        enterTo="translate-y-0 sm:opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="translate-y-0 sm:opacity-100"
                        leaveTo="translate-y-full sm:translate-y-4 sm:opacity-0"
                    >
                        <DialogPanel className="flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:h-[70vh] sm:rounded-2xl dark:bg-slate-800">
                            <div className="shrink-0 px-4 pt-3">
                                <span className="mx-auto block h-1 w-11 rounded-full bg-slate-200 sm:hidden dark:bg-slate-600" />
                                <div className="mt-3 flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <Dialog.Title className="text-[17px] font-semibold text-slate-900 dark:text-slate-100">
                                            {title}
                                        </Dialog.Title>
                                        {subtitle && (
                                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                                        aria-label="Cerrar"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="mt-3 flex h-12 items-center gap-2.5 rounded-lg border border-slate-300 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-600">
                                    <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" />
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={searchPlaceholder}
                                        className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                                    />
                                    {query && (
                                        <button type="button" onClick={() => setQuery('')} aria-label="Limpiar busqueda">
                                            <XCircleIcon className="h-5 w-5 text-slate-400" />
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    {countLabel(filtered.length, items.length)}
                                </p>
                            </div>

                            <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                                {recents.length > 0 && (
                                    <>
                                        <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Recientes
                                        </p>
                                        {recents.map(renderRow)}
                                        <p className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            {query.trim() ? 'Resultados' : 'Todas'}
                                        </p>
                                    </>
                                )}
                                {rest.length === 0 && recents.length === 0 ? (
                                    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                                ) : (
                                    rest.map(renderRow)
                                )}
                            </div>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}

export default SearchSheet;
