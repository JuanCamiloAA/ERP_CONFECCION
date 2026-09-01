import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Link } from '@inertiajs/react';
import { Fragment, useState } from 'react';
import type { ActiveLocation, NavArea } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface Props {
    areas: NavArea[];
    /** Las cuatro áreas de la barra; el quinto destino es siempre «Más». */
    tabs: NavArea[];
    active: ActiveLocation | null;
}

/**
 * Barra inferior de cinco destinos y hoja «Más».
 *
 * En móvil el sidebar desaparece: cuatro áreas caben con un objetivo táctil decente y el
 * resto vive en la hoja. Los cuatro salen de las áreas que el usuario sí puede ver, así que
 * nadie ve un destino que le daría un 403.
 */
export function MobileTabBar({ areas, tabs, active }: Props) {
    const [moreOpen, setMoreOpen] = useState(false);

    /** El primer módulo del área: es a donde lleva el destino de la barra. */
    const entryOf = (area: NavArea) => area.items[0];

    return (
        <>
            <nav
                aria-label="Navegación principal"
                className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-[var(--bar-bg)] pb-[env(safe-area-inset-bottom)] lg:hidden"
                style={{ borderColor: 'var(--edge)' }}
            >
                {tabs.map((area) => {
                    const entry = entryOf(area);
                    const on = active?.area.key === area.key;
                    const Icon = area.icon;

                    if (! entry) return null;

                    return (
                        <Link
                            key={area.key}
                            href={entry.href}
                            aria-current={on ? 'page' : undefined}
                            className={cn(
                                'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                on
                                    ? 'text-[var(--on-fg)]'
                                    : 'text-slate-500 dark:text-slate-400',
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className="w-full truncate text-center text-[10px]">{area.title}</span>
                        </Link>
                    );
                })}

                <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:text-slate-400"
                >
                    <EllipsisHorizontalIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="w-full truncate text-center text-[10px]">Más</span>
                </button>
            </nav>

            <Transition show={moreOpen} as={Fragment}>
                <Dialog onClose={() => setMoreOpen(false)} className="relative z-50 lg:hidden">
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

                    <div className="fixed inset-x-0 bottom-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="translate-y-full"
                            enterTo="translate-y-0"
                            leave="ease-in duration-150"
                            leaveFrom="translate-y-0"
                            leaveTo="translate-y-full"
                        >
                            <DialogPanel className="max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-800">
                                <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                                    <DialogTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Todos los módulos
                                    </DialogTitle>
                                    <button
                                        type="button"
                                        onClick={() => setMoreOpen(false)}
                                        aria-label="Cerrar"
                                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-700"
                                    >
                                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="px-4 py-3">
                                    {areas.map((area) => (
                                        <section key={area.key} className="mb-4 last:mb-0">
                                            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.11em] text-slate-400 dark:text-slate-500">
                                                {area.title}
                                            </h3>

                                            {/*
                                              * `minmax(0,1fr)` y `min-w-0` en cada chip: con `1fr`
                                              * (= `minmax(auto,1fr)`) las etiquetas largas ensanchan
                                              * la pista y la hoja se desborda a lo ancho.
                                              */}
                                            <ul className="grid gap-2 [grid-template-columns:repeat(2,minmax(0,1fr))]">
                                                {area.items.map((item) => {
                                                    const on = active?.item.key === item.key;
                                                    const Icon = item.icon;

                                                    return (
                                                        <li key={item.key} className="min-w-0">
                                                            <Link
                                                                href={item.href}
                                                                onClick={() => setMoreOpen(false)}
                                                                aria-current={on ? 'page' : undefined}
                                                                className={cn(
                                                                    'flex min-h-[48px] min-w-0 items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                                                                    on
                                                                        ? 'border-indigo-500 bg-[var(--on-bg)] text-[var(--on-fg)]'
                                                                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                                                                )}
                                                            >
                                                                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                                                                <span className="min-w-0 flex-1 truncate text-[13px]">
                                                                    {item.label}
                                                                </span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}

export default MobileTabBar;
