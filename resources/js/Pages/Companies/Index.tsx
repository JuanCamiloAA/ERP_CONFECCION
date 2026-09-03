import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDownTrayIcon,
    BuildingOffice2Icon,
    PencilSquareIcon,
    PlusIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { EmptyState } from '@/Components/UI/EmptyState';
import { EntityCard } from '@/Components/UI/EntityCard';
import { FilterChips } from '@/Components/UI/FilterChips';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { RowActionsMenu } from '@/Components/UI/RowActionsMenu';
import { SearchInput } from '@/Components/UI/SearchInput';
import { SortSelect, type SortDirection, type SortOption } from '@/Components/UI/SortSelect';
import { StatBand, type Stat } from '@/Components/UI/StatBand';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { UsageBar } from '@/Components/UI/UsageBar';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { companyInitials, membershipLabel, type MembershipPlanRef } from '@/lib/companies';
import { mediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';

interface CompanyRow {
    id: number;
    name: string;
    nit: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    logo: string | null;
    is_active: boolean;
    membership_ends_at: string | null;
    employees_count: number;
    staff_users_count: number;
    membership_plan: MembershipPlanRef | null;
}

interface Props {
    companies: PaginatedResponse<CompanyRow>;
    filters: { search: string; status: string; plan: string | null; sort: string; direction: SortDirection };
    sorts: SortOption[];
    stats: Stat[];
    chipCounts: Record<string, number>;
    summary: { total: number; active: number; staff_used: number; staff_limit: number | null };
    plans: { id: number; name: string; slug: string }[];
}

const STATUS_CHIPS = [
    { key: 'all', label: 'Todas' },
    { key: 'active', label: 'Activas' },
    { key: 'inactive', label: 'Inactivas' },
    { key: 'at_limit', label: 'Al límite de staff' },
    { key: 'expiring', label: 'Por vencer' },
];

export default function CompaniesIndex({ companies, filters, sorts, stats, chipCounts, summary, plans }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<CompanyRow | null>(null);
    const [view, setView] = useViewMode('companies');

    const hasFilters = Boolean(filters.search) || filters.status !== 'all' || Boolean(filters.plan);

    /**
     * Todo cambio de filtro pasa por aqui para que el resto se conserve: cambiar de estado no
     * puede borrar la busqueda que se acaba de escribir. La pagina no se arrastra a proposito
     * (la 4 de «Todas» no es la 4 de «Por vencer»).
     */
    const applyFilters = (
        next: Partial<{ search: string; status: string; plan: string | null; sort: string; direction: SortDirection }>,
    ) => {
        const merged = {
            search,
            status: filters.status,
            plan: filters.plan,
            sort: filters.sort ?? 'name',
            direction: filters.direction ?? 'asc',
            ...next,
        };
        const params: Record<string, string> = {};

        if (merged.search) params.search = merged.search;
        if (merged.status && merged.status !== 'all') params.status = merged.status;
        if (merged.plan) params.plan = merged.plan;
        if (merged.sort !== 'name') params.sort = merged.sort;
        if (merged.direction !== 'asc') params.direction = merged.direction;

        router.get(route('companies.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const chips = useMemo(
        () => STATUS_CHIPS.map((chip) => ({ ...chip, count: chipCounts[chip.key] ?? 0 })),
        [chipCounts],
    );

    const exportUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters.plan) params.set('plan', filters.plan);
        const query = params.toString();

        return route('companies.export') + (query ? `?${query}` : '');
    }, [filters.search, filters.status, filters.plan]);

    const handleDelete = () => {
        if (! confirmDelete) return;
        router.delete(route('companies.destroy', confirmDelete.id), {
            preserveScroll: true,
            onFinish: () => setConfirmDelete(null),
        });
    };

    const staffSummary = `${summary.staff_used}/${summary.staff_limit ?? '∞'}`;

    const rowActions = (company: CompanyRow) => [
        {
            key: 'users',
            label: 'Usuarios de la empresa',
            icon: <UsersIcon className="h-4 w-4" />,
            href: route('users.index', { company_id: company.id }),
        },
        // El contacto salio de su columna; aqui no es solo texto: abre el correo o marca.
        ...(company.email ? [{ key: 'email', label: company.email, href: `mailto:${company.email}` }] : []),
        ...(company.phone ? [{ key: 'phone', label: company.phone, href: `tel:${company.phone}` }] : []),
    ];

    return (
        <AppLayout title="Empresas">
            <Head title="Empresas" />

            <div className="space-y-6">
                <PageHeader
                    title="Empresas"
                    description={`${summary.total} empresas · ${summary.active} activas · ${staffSummary} usuarios staff`}
                    action={
                        <>
                            <Can permission="companies.index.export">
                                <a href={exportUrl} className="shrink-0">
                                    <Button
                                        variant="outline"
                                        icon={<ArrowDownTrayIcon className="h-4 w-4" />}
                                        className="whitespace-nowrap shrink-0"
                                    >
                                        Exportar
                                    </Button>
                                </a>
                            </Can>
                            <Can permission="companies.index.create">
                                <Link href={route('companies.create')} className="shrink-0">
                                    <Button icon={<PlusIcon className="h-4 w-4" />} className="whitespace-nowrap shrink-0">
                                        Nueva empresa
                                    </Button>
                                </Link>
                            </Can>
                        </>
                    }
                />

                <StatBand stats={stats} />

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            applyFilters({ search: v });
                        }}
                        placeholder="Buscar por nombre o NIT..."
                        className="lg:max-w-xs"
                    />

                    <FilterChips
                        chips={chips}
                        active={filters.status ?? 'all'}
                        onChange={(key) => applyFilters({ status: key })}
                        label="Estado de la empresa"
                        className="lg:flex-1"
                    />

                    {plans.length > 0 ? (
                        <div className="w-full sm:w-48 lg:w-44">
                            <select
                                value={filters.plan ?? ''}
                                onChange={(e) => applyFilters({ plan: e.target.value || null })}
                                aria-label="Filtrar por plan"
                                // Sin `.emp-field`: esa clase fija 38/44px de alto y aqui el
                                // select convive con los controles de filtro, que son de 32px.
                                className="h-8 w-full rounded-lg border px-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--emp-accent)]"
                                style={{
                                    borderColor: 'var(--emp-border)',
                                    backgroundColor: 'var(--emp-field)',
                                    color: 'var(--emp-text)',
                                }}
                            >
                                <option value="">Todos los planes</option>
                                {plans.map((plan) => (
                                    <option key={plan.id} value={plan.slug}>
                                        {plan.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    <div className="flex items-center gap-2 lg:ml-auto">
                        <SortSelect
                            options={sorts}
                            value={filters.sort ?? 'name'}
                            direction={filters.direction ?? 'asc'}
                            onChange={(sort, direction) => applyFilters({ sort, direction })}
                        />

                        <ViewToggle value={view} onChange={setView} />
                    </div>
                </div>

                {companies.data.length === 0 ? (
                    <EmptyState
                        icon={<BuildingOffice2Icon className="h-8 w-8" />}
                        title="No se encontraron empresas"
                        description={
                            hasFilters
                                ? 'Ninguna empresa coincide con los filtros aplicados.'
                                : 'Todavía no hay empresas registradas en el sistema.'
                        }
                        action={
                            hasFilters ? (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        router.get(route('companies.index'), {}, { preserveScroll: true, replace: true });
                                    }}
                                >
                                    Limpiar filtros
                                </Button>
                            ) : (
                                <Can permission="companies.index.create">
                                    <Link href={route('companies.create')}>
                                        <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva empresa</Button>
                                    </Link>
                                </Can>
                            )
                        }
                    />
                ) : view === 'table' ? (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Empresa</TableHeader>
                                <TableHeader>Plan</TableHeader>
                                <TableHeader>Usuarios staff</TableHeader>
                                <TableHeader align="right">Empleados</TableHeader>
                                <TableHeader>Membresía</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {companies.data.map((company) => {
                                const membership = membershipLabel(company.membership_ends_at);

                                return (
                                    <TableRow key={company.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {company.logo ? (
                                                    <Avatar src={mediaUrl(company.logo)} name={company.name} size="sm" zoomable />
                                                ) : (
                                                    <span
                                                        aria-hidden="true"
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                                                    >
                                                        {companyInitials(company.name)}
                                                    </span>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-[14px] text-[color:var(--emp-text)]">
                                                            {company.name}
                                                        </p>
                                                        <Badge variant={company.is_active ? 'success' : 'danger'}>
                                                            {company.is_active ? 'Activa' : 'Inactiva'}
                                                        </Badge>
                                                    </div>
                                                    <p className="truncate text-[12px] text-[color:var(--emp-muted)]">
                                                        {[company.nit, company.address].filter(Boolean).join(' · ') || 'Sin NIT'}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <Badge variant="neutral">{company.membership_plan?.name ?? 'Sin plan'}</Badge>
                                        </TableCell>

                                        <TableCell>
                                            <UsageBar
                                                used={company.staff_users_count}
                                                limit={company.membership_plan?.max_staff_users ?? null}
                                                className="min-w-[9rem]"
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <span className="tabular-nums">{company.employees_count}</span>
                                        </TableCell>

                                        <TableCell>
                                            <span
                                                className={cn(
                                                    'text-xs',
                                                    membership.tone === 'expired' && 'font-medium text-rose-600 dark:text-rose-400',
                                                    membership.tone === 'soon' && 'font-medium text-amber-600 dark:text-amber-400',
                                                    membership.tone === 'default' && 'text-[color:var(--emp-muted)]',
                                                )}
                                            >
                                                {membership.text}
                                            </span>
                                        </TableCell>

                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Can permission="companies.index.edit">
                                                    <Link href={route('companies.edit', company.id)}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<PencilSquareIcon className="h-4 w-4" />}
                                                            aria-label={`Editar ${company.name}`}
                                                        />
                                                    </Link>
                                                </Can>
                                                <RowActionsMenu
                                                    actions={[
                                                        ...rowActions(company),
                                                        ...(company.is_active
                                                            ? [
                                                                  {
                                                                      key: 'deactivate',
                                                                      label: 'Desactivar empresa',
                                                                      danger: true,
                                                                      onClick: () => setConfirmDelete(company),
                                                                  },
                                                              ]
                                                            : []),
                                                    ]}
                                                    label={`Acciones de ${company.name}`}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                        {companies.data.map((company) => {
                            const membership = membershipLabel(company.membership_ends_at);

                            return (
                                <EntityCard
                                    key={company.id}
                                    initials={companyInitials(company.name)}
                                    logo={
                                        company.logo ? (
                                            <Avatar src={mediaUrl(company.logo)} name={company.name} size="sm" zoomable />
                                        ) : undefined
                                    }
                                    title={company.name}
                                    subtitle={company.nit ?? 'Sin NIT'}
                                    status={
                                        <Badge variant={company.is_active ? 'success' : 'danger'}>
                                            {company.is_active ? 'Activa' : 'Inactiva'}
                                        </Badge>
                                    }
                                    metrics={[
                                        { label: 'Empleados', value: String(company.employees_count) },
                                        { label: 'Staff', value: String(company.staff_users_count) },
                                    ]}
                                    usage={
                                        <UsageBar
                                            used={company.staff_users_count}
                                            limit={company.membership_plan?.max_staff_users ?? null}
                                            label="Usuarios staff"
                                        />
                                    }
                                    tag={
                                        <span className="flex flex-wrap items-center gap-x-1.5">
                                            <span>{company.membership_plan?.name ?? 'Sin plan'}</span>
                                            <span aria-hidden="true">·</span>
                                            <span
                                                className={cn(
                                                    membership.tone === 'expired' && 'font-medium text-rose-600 dark:text-rose-400',
                                                    membership.tone === 'soon' && 'font-medium text-amber-600 dark:text-amber-400',
                                                )}
                                            >
                                                {membership.text}
                                            </span>
                                        </span>
                                    }
                                    actions={
                                        <>
                                            <Can permission="companies.index.edit">
                                                <Link href={route('companies.edit', company.id)}>
                                                    <Button variant="outline" size="sm">
                                                        Editar
                                                    </Button>
                                                </Link>
                                            </Can>
                                            <Link href={route('users.index', { company_id: company.id })}>
                                                <Button variant="ghost" size="sm">
                                                    Usuarios
                                                </Button>
                                            </Link>
                                        </>
                                    }
                                />
                            );
                        })}
                    </div>
                )}

                <Pagination links={companies.links} from={companies.from} to={companies.to} total={companies.total} />
            </div>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Desactivar empresa"
                message={`Seguro que deseas desactivar "${confirmDelete?.name}"? Sus empleados y usuarios dejaran de tener acceso.`}
                confirmText="Desactivar"
                variant="danger"
            />
        </AppLayout>
    );
}
