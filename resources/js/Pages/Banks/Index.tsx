import { Head, Link, router } from '@inertiajs/react';
import { BuildingLibraryIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { BankLogo } from '@/Components/UI/BankLogo';
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
import { Switch } from '@/Components/UI/Switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import type { Bank, PaginatedResponse } from '@/types';

type BankRow = Bank & { employees_count: number };

interface Props {
    banks: PaginatedResponse<BankRow>;
    filters: { search: string; status: string; sort: string; direction: SortDirection };
    sorts: SortOption[];
    stats: Stat[];
    chipCounts: Record<string, number>;
}

const STATUS_CHIPS = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'wallet', label: 'Billeteras' },
    { key: 'without_logo', label: 'Sin logo' },
];

export default function BanksIndex({ banks, filters, sorts, stats, chipCounts }: Props) {
    const { can } = usePermissions();
    const canToggle = can('banks.index.toggle');

    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<BankRow | null>(null);
    const [view, setView] = useViewMode('banks');

    /** Copia local para que el interruptor responda al instante; se resincroniza con el servidor. */
    const [rows, setRows] = useState<BankRow[]>(banks.data);
    useEffect(() => setRows(banks.data), [banks.data]);

    const hasFilters = Boolean(filters.search) || (filters.status ?? 'all') !== 'all';

    /** Todo cambio pasa por aquí para que buscador, chip y orden no se pisen entre ellos. */
    const applyFilters = (next: Partial<{ search: string; status: string; sort: string; direction: SortDirection }>) => {
        const merged = {
            search,
            status: filters.status ?? 'all',
            sort: filters.sort ?? 'name',
            direction: filters.direction ?? 'asc',
            ...next,
        };
        const params: Record<string, string> = {};

        if (merged.search) params.search = merged.search;
        if (merged.status !== 'all') params.status = merged.status;
        if (merged.sort !== 'name') params.sort = merged.sort;
        if (merged.direction !== 'asc') params.direction = merged.direction;

        router.get(route('banks.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const chips = useMemo(
        () => STATUS_CHIPS.map((chip) => ({ ...chip, count: chipCounts?.[chip.key] ?? 0 })),
        [chipCounts],
    );

    const toggle = (bank: BankRow, value: boolean) => {
        setRows((current) => current.map((b) => (b.id === bank.id ? { ...b, is_active: value } : b)));

        router.patch(
            route('banks.toggle', bank.id),
            { is_active: value },
            {
                preserveScroll: true,
                preserveState: true,
                // Si el servidor rechaza, el interruptor vuelve a lo guardado en vez de
                // quedarse mostrando el estado que se pidió.
                onError: () => setRows(banks.data),
                onSuccess: () => setRows(banks.data),
            },
        );
    };

    const handleDelete = () => {
        if (! confirmDelete) return;
        router.delete(route('banks.destroy', confirmDelete.id), {
            preserveScroll: true,
            onFinish: () => setConfirmDelete(null),
        });
    };

    const clearFilters = () => {
        setSearch('');
        router.get(route('banks.index'), {}, { preserveScroll: true, replace: true });
    };

    return (
        <AppLayout title="Bancos">
            <Head title="Bancos" />

            <div className="space-y-6">
                <PageHeader
                    title="Bancos"
                    description="Catálogo de bancos para los datos de pago de empleados. El logo se muestra al elegir el banco en la ficha del empleado y en los desprendibles."
                    action={
                        <Can permission="banks.index.create">
                            <Link href={route('banks.create')} className="shrink-0">
                                <Button icon={<PlusIcon className="h-4 w-4" />} className="whitespace-nowrap shrink-0">
                                    Nuevo banco
                                </Button>
                            </Link>
                        </Can>
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
                        placeholder="Buscar por nombre o codigo..."
                        className="lg:max-w-xs"
                    />

                    <FilterChips
                        chips={chips}
                        active={filters.status ?? 'all'}
                        onChange={(key) => applyFilters({ status: key })}
                        label="Estado del banco"
                        className="lg:flex-1"
                    />

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

                {rows.length === 0 ? (
                    <EmptyState
                        icon={<BuildingLibraryIcon className="h-8 w-8" />}
                        title="No hay bancos"
                        description={
                            hasFilters
                                ? 'Ningún banco coincide con los filtros aplicados.'
                                : 'Registra el primero para poder capturar los datos de pago de los empleados.'
                        }
                        action={
                            hasFilters ? (
                                <Button variant="outline" onClick={clearFilters}>
                                    Limpiar filtros
                                </Button>
                            ) : (
                                <Can permission="banks.index.create">
                                    <Link href={route('banks.create')}>
                                        <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo banco</Button>
                                    </Link>
                                </Can>
                            )
                        }
                    />
                ) : view === 'table' ? (
                    <div>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Banco</TableHeader>
                                    <TableHeader>Codigo</TableHeader>
                                    <TableHeader align="right">Empleados</TableHeader>
                                    <TableHeader align="center">Estado</TableHeader>
                                    <TableHeader align="right">Acciones</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((bank) => (
                                    <TableRow key={bank.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <BankLogo
                                                    name={bank.name}
                                                    initials={bank.initials}
                                                    logoUrl={bank.logo_url}
                                                    brandColor={bank.brand_color}
                                                    size={34}
                                                />
                                                <div className="min-w-0">
                                                    <p className="truncate text-[14px] text-[color:var(--emp-text)]">
                                                        {bank.name}
                                                    </p>
                                                    <p className="truncate text-[12px] text-[color:var(--emp-muted)]">
                                                        {bank.type_label}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <span className="font-mono text-sm text-indigo-600 dark:text-indigo-300">
                                                {bank.code ?? '—'}
                                            </span>
                                        </TableCell>

                                        <TableCell align="right">
                                            <span className="tabular-nums">{bank.employees_count ?? 0}</span>
                                        </TableCell>

                                        <TableCell align="center">
                                            {canToggle ? (
                                                <Switch
                                                    checked={bank.is_active}
                                                    onChange={(v) => toggle(bank, v)}
                                                />
                                            ) : (
                                                <Badge variant={bank.is_active ? 'success' : 'danger'}>
                                                    {bank.is_active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            )}
                                        </TableCell>

                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Can permission="banks.index.edit">
                                                    <Link href={route('banks.edit', bank.id)}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<PencilSquareIcon className="h-4 w-4" />}
                                                            aria-label={`Editar ${bank.name}`}
                                                        />
                                                    </Link>
                                                </Can>
                                                <RowActionsMenu
                                                    label={`Acciones de ${bank.name}`}
                                                    actions={[
                                                        {
                                                            key: 'edit',
                                                            label: 'Editar banco',
                                                            href: route('banks.edit', bank.id),
                                                        },
                                                        {
                                                            key: 'delete',
                                                            label: 'Eliminar o desactivar',
                                                            danger: true,
                                                            onClick: () => setConfirmDelete(bank),
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <p className="mt-2 px-1 text-[12px] text-[color:var(--emp-muted)]">
                            Los bancos sin logo muestran el monograma del código. Sube el logo desde Editar banco.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                        {rows.map((bank) => (
                            <EntityCard
                                key={bank.id}
                                logo={
                                    <BankLogo
                                        name={bank.name}
                                        initials={bank.initials}
                                        logoUrl={bank.logo_url}
                                        brandColor={bank.brand_color}
                                        size={44}
                                    />
                                }
                                title={bank.name}
                                subtitle={`${bank.code ?? 'Sin código'} · ${bank.type_label}`}
                                status={
                                    <Badge variant={bank.is_active ? 'success' : 'danger'}>
                                        {bank.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                }
                                metrics={[{ label: 'Empleados', value: String(bank.employees_count ?? 0) }]}
                                tag={bank.logo_url ? 'Logo cargado' : 'Usa monograma'}
                                actions={
                                    <>
                                        <Can permission="banks.index.edit">
                                            <Link href={route('banks.edit', bank.id)}>
                                                <Button variant="outline" size="sm">
                                                    Editar
                                                </Button>
                                            </Link>
                                        </Can>
                                        <Can permission="banks.index.delete">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                onClick={() => setConfirmDelete(bank)}
                                                aria-label={`Eliminar ${bank.name}`}
                                            />
                                        </Can>
                                    </>
                                }
                            />
                        ))}
                    </div>
                )}

                <Pagination links={banks.links} from={banks.from} to={banks.to} total={banks.total} />
            </div>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar o desactivar banco"
                message={
                    confirmDelete && (confirmDelete.employees_count ?? 0) > 0
                        ? `${confirmDelete.employees_count} ${(confirmDelete.employees_count ?? 0) === 1 ? 'empleado usa' : 'empleados usan'} "${confirmDelete.name}", así que se desactivará en lugar de borrarse y conservarán sus datos de pago.`
                        : `Se eliminará "${confirmDelete?.name}" del catálogo junto con su logo.`
                }
                confirmText="Continuar"
                variant="danger"
            />
        </AppLayout>
    );
}
