import { router } from '@inertiajs/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import type { PaginationLink } from '@/types';

interface PaginationProps {
    links: PaginationLink[];
    from: number | null;
    to: number | null;
    total: number;
    only?: string[];
    preserveScroll?: boolean;
}

export function Pagination({ links, from, to, total, only, preserveScroll = true }: PaginationProps) {
    if (links.length <= 3) return null;

    const handleClick = (url: string | null) => {
        if (!url) return;
        router.visit(url, { preserveScroll, only });
    };

    return (
        <div className="flex flex-col items-center justify-between gap-4 px-1 py-3 sm:flex-row">
            <p className="text-sm text-slate-600 dark:text-slate-400">
                Mostrando <span className="font-semibold text-slate-900 dark:text-slate-100">{from ?? 0}</span> a{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{to ?? 0}</span> de{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span> resultados
            </p>
            <nav className="inline-flex items-center gap-1">
                {links.map((link, index) => {
                    const label = link.label
                        .replace('&laquo;', '')
                        .replace('&raquo;', '')
                        .replace('Previous', '')
                        .replace('Next', '')
                        .replace('Anterior', '')
                        .replace('Siguiente', '')
                        .trim();
                    const isPrev = index === 0;
                    const isNext = index === links.length - 1;

                    if (isPrev || isNext) {
                        return (
                            <button
                                key={index}
                                onClick={() => handleClick(link.url)}
                                disabled={!link.url}
                                className={cn(
                                    'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
                                    'border border-slate-200 dark:border-slate-700',
                                    link.url
                                        ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                                        : 'cursor-not-allowed text-slate-300 dark:text-slate-600',
                                )}
                            >
                                {isPrev ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </button>
                        );
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => handleClick(link.url)}
                            disabled={!link.url}
                            className={cn(
                                'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-sm transition-colors',
                                'border',
                                link.active
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700',
                                !link.url && 'cursor-not-allowed opacity-50',
                            )}
                        >
                            {label || '...'}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

export default Pagination;
