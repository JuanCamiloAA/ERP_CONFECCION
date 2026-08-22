import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { ArrowDownTrayIcon, ChevronDownIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
    /**
     * Referencias a exportar. Vacio significa «todas las que coincidan con la busqueda»,
     * que es lo mismo que entiende el backend (ReferenceController::exportSelection).
     */
    ids?: number[];
    /** Busqueda vigente del listado; solo se usa cuando no hay seleccion. */
    search?: string;
    label?: string;
    /** Texto bajo el titulo del menu, para que quede claro que se va a exportar. */
    hint?: string;
    buttonClassName?: string;
    trigger?: ReactNode;
    disabled?: boolean;
    className?: string;
}

/**
 * Menu de exportacion de referencias: Excel o PDF, misma informacion en los dos.
 *
 * Los dos destinos son enlaces normales, no visitas de Inertia: uno descarga un archivo
 * y el otro abre la vista imprimible en otra pestana, y ninguno de los dos debe cambiar
 * la pagina donde esta trabajando quien exporta.
 */
export function ReferenceExportMenu({
    ids = [],
    search,
    label = 'Exportar',
    hint,
    buttonClassName,
    trigger,
    disabled = false,
    className,
}: Props) {
    const params: Record<string, string> = {};
    if (ids.length > 0) {
        params.ids = ids.join(',');
    } else if (search) {
        params.search = search;
    }

    const excelUrl = route('references.export.excel', params);
    const pdfUrl = route('references.export.pdf', params);

    const item = (icon: ReactNode, title: string, description: string) => (
        <span className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left">
            <span className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
            <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
            </span>
        </span>
    );

    return (
        <Menu as="div" className={cn('relative shrink-0', className)}>
            <MenuButton
                disabled={disabled}
                className={cn(
                    buttonClassName ??
                        cn(
                            'inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm',
                            'font-medium text-slate-700 transition-colors hover:bg-slate-50',
                            'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                        ),
                    disabled && 'cursor-not-allowed opacity-50',
                )}
            >
                {trigger ?? (
                    <>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        {label}
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                    </>
                )}
            </MenuButton>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <MenuItems
                    anchor="bottom end"
                    className="z-50 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                >
                    {hint ? (
                        <p className="border-b border-slate-100 px-3.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            {hint}
                        </p>
                    ) : null}

                    <MenuItem>
                        <a href={excelUrl} className="block w-full data-focus:bg-slate-50 dark:data-focus:bg-slate-700/50">
                            {item(<TableCellsIcon className="h-5 w-5" />, 'Excel (.xlsx)', 'Ficha por referencia, con imagen y detalle de costos.')}
                        </a>
                    </MenuItem>

                    <MenuItem>
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full data-focus:bg-slate-50 dark:data-focus:bg-slate-700/50"
                        >
                            {item(<DocumentTextIcon className="h-5 w-5" />, 'PDF', 'Abre la ficha imprimible: elige «Guardar como PDF».')}
                        </a>
                    </MenuItem>
                </MenuItems>
            </Transition>
        </Menu>
    );
}

export default ReferenceExportMenu;
