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

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 translate-y-4 scale-95"
                            enterTo="opacity-100 translate-y-0 scale-100"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 translate-y-0 scale-100"
                            leaveTo="opacity-0 translate-y-4 scale-95"
                        >
                            <DialogPanel
                                className={cn(
                                    'w-full transform overflow-hidden rounded-xl bg-white shadow-xl transition-all',
                                    'dark:bg-slate-800 dark:border dark:border-slate-700',
                                    sizes[size],
                                )}
                            >
                                {(title || showClose) && (
                                    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
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
                                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="px-6 py-4">{children}</div>
                                {footer && (
                                    <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-900/50">
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
