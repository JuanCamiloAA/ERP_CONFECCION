import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { BuildingOffice2Icon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { router, usePage } from '@inertiajs/react';
import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils';

type CompanyOpt = { id: number; name: string; is_active: boolean };

type Row = { id: number | null; label: string };

export function SuperAdminCompanySwitcher() {
    const page = usePage<App.PageProps>();
    const user = page.props.auth.user;
    const companies = (page.props.companiesForSelector ?? []) as CompanyOpt[];
    const activeId = page.props.activeCompanyId ?? null;

    const options = useMemo((): Row[] => {
        return [{ id: null, label: 'Todas las empresas' }, ...companies.map((c) => ({ id: c.id, label: c.name }))];
    }, [companies]);

    const selected = useMemo(() => options.find((o) => o.id === activeId) ?? options[0], [options, activeId]);

    if (!user?.is_super_admin) {
        return null;
    }

    return (
        <Listbox
            value={selected}
            onChange={(row: Row) => {
                router.post(
                    route('super-admin.active-company'),
                    { company_id: row.id },
                    { preserveScroll: false },
                );
            }}
        >
            <div className="relative min-w-0 max-w-[min(100%,14rem)] sm:max-w-[16rem]">
                <ListboxButton
                    className={cn(
                        'relative flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-8 text-left text-xs font-medium text-slate-800 shadow-sm sm:text-sm',
                        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                    )}
                >
                    <BuildingOffice2Icon className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                    <span className="block truncate">{selected.label}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
                        <ChevronUpDownIcon className="h-4 w-4 text-slate-400" aria-hidden />
                    </span>
                </ListboxButton>
                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <ListboxOptions
                        className={cn(
                            'z-50 mt-1 max-h-60 min-w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg',
                            'dark:border-slate-600 dark:bg-slate-800',
                        )}
                    >
                        {options.map((row) => (
                            <ListboxOption
                                key={row.id === null ? 'allCompanies' : row.id}
                                value={row}
                                className={({ focus }) =>
                                    cn(
                                        'cursor-pointer px-3 py-2 text-sm',
                                        focus ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200',
                                    )
                                }
                            >
                                {row.label}
                            </ListboxOption>
                        ))}
                    </ListboxOptions>
                </Transition>
            </div>
        </Listbox>
    );
}
