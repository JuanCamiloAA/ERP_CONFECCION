import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RowAction {
    key: string;
    label: string;
    icon?: ReactNode;
    /** Enlace (Inertia/normal). Si se define, la opcion se renderiza como <a>. */
    href?: string;
    onClick?: () => void;
    /** Pinta la opcion en rojo (eliminar, inactivar). */
    danger?: boolean;
    disabled?: boolean;
}

interface RowActionsMenuProps {
    actions: RowAction[];
    label?: string;
    className?: string;
}

/**
 * Menu de acciones por fila para la vista movil: un solo objetivo tactil de 44px que
 * despliega opciones tambien de 44px, en lugar de varios botones de 32px alineados.
 * Las acciones ya vienen filtradas por permisos desde la pagina que lo usa.
 */
export function RowActionsMenu({ actions, label = 'Acciones', className }: RowActionsMenuProps) {
    const visible = actions.filter(Boolean);

    if (visible.length === 0) {
        return null;
    }

    return (
        <Menu as="div" className={cn('relative shrink-0', className)}>
            <MenuButton
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label={label}
                onClick={(e) => e.stopPropagation()}
            >
                <EllipsisVerticalIcon className="h-5 w-5" />
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
                    className="z-50 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                >
                    {visible.map((action) => {
                        const content = (
                            <span className="flex h-11 w-full items-center gap-2.5 px-3.5 text-left text-sm">
                                {action.icon ? <span className="shrink-0">{action.icon}</span> : null}
                                {action.label}
                            </span>
                        );

                        const base = cn(
                            'block w-full',
                            action.danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200',
                            action.disabled && 'pointer-events-none opacity-50',
                        );

                        return (
                            <MenuItem key={action.key}>
                                {action.href ? (
                                    <a
                                        href={action.href}
                                        className={cn(base, 'data-focus:bg-slate-50 dark:data-focus:bg-slate-700/50')}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {content}
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={action.disabled}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick?.();
                                        }}
                                        className={cn(base, 'data-focus:bg-slate-50 dark:data-focus:bg-slate-700/50')}
                                    >
                                        {content}
                                    </button>
                                )}
                            </MenuItem>
                        );
                    })}
                </MenuItems>
            </Transition>
        </Menu>
    );
}

export default RowActionsMenu;
