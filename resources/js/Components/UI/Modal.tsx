import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: Size;
    closeOnBackdrop?: boolean;
    showClose?: boolean;
    /**
     * En movil se pega abajo como hoja, con la cabecera y el pie fijos y el cuerpo
     * desplazandose por dentro. En escritorio no cambia nada. Es opcional a proposito:
     * los demas usos del modal en el proyecto siguen viendose igual.
     */
    sheetOnMobile?: boolean;
}

const sizes: Record<Size, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
};

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    closeOnBackdrop = true,
    showClose = true,
    sheetOnMobile = false,
}: ModalProps) {
    return (
        <Transition show={open} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-50"
                onClose={closeOnBackdrop ? onClose : () => {}}
            >
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
                </TransitionChild>

                <div className={cn('fixed inset-0', sheetOnMobile ? 'overflow-hidden sm:overflow-y-auto' : 'overflow-y-auto')}>
                    <div
                        className={cn(
                            'flex min-h-full justify-center',
                            sheetOnMobile ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-4',
                        )}
                    >
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-200"
                            // La hoja sube; el modal de escritorio escala. Escalar una hoja
                            // pegada al borde inferior se ve como un salto.
                            enterFrom={sheetOnMobile ? 'opacity-0 translate-y-8' : 'opacity-0 translate-y-4 scale-95'}
                            enterTo={sheetOnMobile ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0 scale-100'}
                            leave="ease-in duration-150"
                            leaveFrom={sheetOnMobile ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0 scale-100'}
                            leaveTo={sheetOnMobile ? 'opacity-0 translate-y-8' : 'opacity-0 translate-y-4 scale-95'}
                        >
                            <DialogPanel
                                className={cn(
                                    'w-full transform bg-white shadow-xl transition-all',
                                    'dark:bg-slate-800 dark:border dark:border-slate-700',
                                    sheetOnMobile
                                        ? 'flex max-h-[92vh] flex-col rounded-t-2xl sm:max-h-[85vh] sm:rounded-xl'
                                        : 'overflow-hidden rounded-xl',
                                    sizes[size],
                                )}
                            >
                                {sheetOnMobile && (
                                    <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
                                        <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    </div>
                                )}

                                {(title || showClose) && (
                                    <div
                                        className={cn(
                                            'flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700',
                                            sheetOnMobile && 'shrink-0',
                                        )}
                                    >
                                        <div className="flex-1">
                                            {title && (
                                                <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                                    {title}
                                                </DialogTitle>
                                            )}
                                            {description && (
                                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    {description}
                                                </p>
                                            )}
                                        </div>
                                        {showClose && (
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                aria-label="Cerrar"
                                                className={cn(
                                                    'rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200',
                                                    // 44px de objetivo tactil en la hoja movil.
                                                    sheetOnMobile ? 'flex h-11 w-11 items-center justify-center sm:h-auto sm:w-auto sm:p-1' : 'p-1',
                                                )}
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div
                                    className={cn(
                                        'px-6 py-4',
                                        sheetOnMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
                                    )}
                                >
                                    {children}
                                </div>

                                {footer && (
                                    <div
                                        className={cn(
                                            'flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-900/50',
                                            sheetOnMobile && 'shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                                        )}
                                    >
                                        {footer}
                                    </div>
                                )}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

export default Modal;
