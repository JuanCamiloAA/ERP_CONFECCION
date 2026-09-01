import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { router } from '@inertiajs/react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { NavArea } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface ResultItem {
    id: string;
    title: string;
    subtitle?: string;
    url: string;
}

interface ResultGroup {
    key: string;
    label: string;
    items: ResultItem[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Los módulos permitidos también son resultados: ir a una pantalla es lo más buscado. */
    areas: NavArea[];
}

/**
 * Buscador global de ⌘K.
 *
 * Busca dos cosas a la vez: pantallas (los módulos que el usuario puede abrir) y registros
 * —empleados, referencias y nóminas— que el servidor filtra por permisos. Las pantallas se
 * resuelven en el cliente porque ya están en memoria y responder al instante es la mitad de
 * la utilidad de un atajo de teclado.
 */
export function CommandPalette({ open, onClose, areas }: Props) {
    const [term, setTerm] = useState('');
    const [remote, setRemote] = useState<ResultGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (! open) {
            setTerm('');
            setRemote([]);
            setCursor(0);
        }
    }, [open]);

    // Pantallas: filtro local sobre lo que ya se pintó en el sidebar.
    const localGroup = useMemo<ResultGroup | null>(() => {
        const needle = term.trim().toLowerCase();
        if (needle === '') return null;

        const items: ResultItem[] = [];

        areas.forEach((area) => {
            area.items.forEach((item) => {
                if (`${area.title} ${item.label}`.toLowerCase().includes(needle)) {
                    items.push({
                        id: `nav-${item.key}`,
                        title: item.label,
                        subtitle: area.title,
                        url: item.href,
                    });
                }
            });
        });

        return items.length > 0 ? { key: 'nav', label: 'Ir a', items: items.slice(0, 6) } : null;
    }, [areas, term]);

    // Registros: una petición por término, con 250 ms de espera y cancelación de la anterior
    // para no dejar que una respuesta lenta pise a la de lo que se está escribiendo ahora.
    useEffect(() => {
        const needle = term.trim();

        if (needle.length < 2) {
            setRemote([]);
            setLoading(false);

            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);

            fetch(`${route('search.global')}?q=${encodeURIComponent(needle)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
                credentials: 'same-origin',
            })
                .then((response) => (response.ok ? response.json() : { groups: [] }))
                .then((data: { groups?: ResultGroup[] }) => setRemote(data.groups ?? []))
                .catch(() => {
                    /* petición cancelada o red caída: se deja lo que ya hay */
                })
                .finally(() => setLoading(false));
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [term]);

    const groups = useMemo(
        () => [...(localGroup ? [localGroup] : []), ...remote],
        [localGroup, remote],
    );

    const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

    useEffect(() => setCursor(0), [flat.length]);

    const go = (url: string) => {
        onClose();
        router.visit(url);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (flat.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((c) => (c + 1) % flat.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((c) => (c - 1 + flat.length) % flat.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = flat[cursor];
            if (target) go(target.url);
        }
    };

    let index = -1;

    return (
        <Transition show={open} as={Fragment}>
            <Dialog onClose={onClose} initialFocus={inputRef} className="relative z-50">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-150"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6 md:p-16">
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-150"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-100"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <DialogPanel className="mx-auto max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700">
                                <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                                <input
                                    ref={inputRef}
                                    value={term}
                                    onChange={(e) => setTerm(e.target.value)}
                                    onKeyDown={onKeyDown}
                                    placeholder="Buscar pantallas, empleados, referencias o nóminas…"
                                    aria-label="Buscar en la aplicación"
                                    className="h-12 w-full border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100"
                                />
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto p-2">
                                {term.trim() === '' ? (
                                    <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                                        Escribe para buscar. ↑ ↓ para moverte, Enter para abrir.
                                    </p>
                                ) : groups.length === 0 ? (
                                    <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                                        {loading ? 'Buscando…' : `Sin resultados para «${term}».`}
                                    </p>
                                ) : (
                                    groups.map((group) => (
                                        <div key={group.key} className="mb-2 last:mb-0">
                                            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.11em] text-slate-400 dark:text-slate-500">
                                                {group.label}
                                            </p>
                                            <ul>
                                                {group.items.map((item) => {
                                                    index += 1;
                                                    const on = index === cursor;

                                                    return (
                                                        <li key={item.id}>
                                                            <button
                                                                type="button"
                                                                onMouseEnter={() => setCursor(flat.indexOf(item))}
                                                                onClick={() => go(item.url)}
                                                                className={cn(
                                                                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                                                                    on
                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/50',
                                                                )}
                                                            >
                                                                <span className="min-w-0">
                                                                    <span className="block truncate text-sm text-slate-900 dark:text-slate-100">
                                                                        {item.title}
                                                                    </span>
                                                                    {item.subtitle ? (
                                                                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                                            {item.subtitle}
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogPanel>
                    </TransitionChild>
                </div>
            </Dialog>
        </Transition>
    );
}

export default CommandPalette;
