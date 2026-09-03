import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CalendarDaysIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { EmptyState } from '@/Components/UI/EmptyState';
import { FilterChips } from '@/Components/UI/FilterChips';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Switch } from '@/Components/UI/Switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { UsageBar } from '@/Components/UI/UsageBar';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import { slugifyCode } from '@/lib/slugifyCode';
import type { PaginatedResponse } from '@/types';

interface PeriodicityRow {
    id: number;
    code: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    payrolls_count: number;
    companies_count: number;
}

interface Props {
    periodicities: PaginatedResponse<PeriodicityRow>;
    filters: { search: string; status: string };
    chipCounts: Record<string, number>;
}

const STATUS_CHIPS = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'inactive', label: 'Inactivos' },
];

export default function PayrollPeriodicitiesIndex({ periodicities, filters, chipCounts }: Props) {
    const { can } = usePermissions();
    const canReorder = can('payroll_periodicities.index.reorder');
    const canToggle = can('payroll_periodicities.index.toggle');

    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<PeriodicityRow | null>(null);
    const [view, setView] = useViewMode('payroll-periodicities');

    /**
     * Copia local del orden para que arrastrar arriba/abajo se vea al instante. Se resincroniza
     * con el servidor en cuanto llegan filas nuevas (otra pagina, otro filtro, respuesta del
     * reordenamiento), de modo que un fallo del servidor deshace el movimiento en pantalla.
     */
    const [rows, setRows] = useState<PeriodicityRow[]>(periodicities.data);
    useEffect(() => setRows(periodicities.data), [periodicities.data]);

    const maxPayrolls = useMemo(() => Math.max(1, ...rows.map((row) => row.payrolls_count ?? 0)), [rows]);
    const hasFilters = Boolean(filters.search) || (filters.status ?? 'all') !== 'all';

    const applyFilters = (next: Partial<{ search: string; status: string }>) => {
        const merged = { search, status: filters.status ?? 'all', ...next };
        const params: Record<string, string> = {};
        if (merged.search) params.search = merged.search;
        if (merged.status !== 'all') params.status = merged.status;

        router.get(route('payroll-periodicities.index'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= rows.length) return;

        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
        setRows(next);

        router.patch(
            route('payroll-periodicities.reorder'),
            { ids: next.map((row) => row.id) },
            { preserveScroll: true, preserveState: true, onError: () => setRows(periodicities.data) },
        );
    };

    const toggle = (row: PeriodicityRow, value: boolean) => {
        setRows((current) => current.map((r) => (r.id === row.id ? { ...r, is_active: value } : r)));

        router.patch(
            route('payroll-periodicities.toggle', row.id),
            { is_active: value },
            {
                preserveScroll: true,
                preserveState: true,
                // Si el servidor falla, el interruptor debe volver a lo que hay guardado en
                // vez de quedarse mostrando el estado que se pidio.
                onError: () => setRows(periodicities.data),
                onSuccess: () => setRows(periodicities.data),
            },
        );
    };

    const handleDelete = () => {
        if (! confirmDelete) return;
        router.delete(route('payroll-periodicities.destroy', confirmDelete.id), {
            preserveScroll: true,
            onFinish: () => setConfirmDelete(null),
        });
    };

    const chips = useMemo(
        () => STATUS_CHIPS.map((chip) => ({ ...chip, count: chipCounts?.[chip.key] ?? 0 })),
        [chipCounts],
    );

    const reorderButtons = (index: number, row: PeriodicityRow) => (
        <div className="flex items-center">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<ArrowUpIcon className="h-4 w-4" />}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${row.name}`}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<ArrowDownIcon className="h-4 w-4" />}
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={`Bajar ${row.name}`}
            />
        </div>
    );

    return (
        <AppLayout title="Periodicidad de pagos">
            <Head title="Periodicidad de pagos" />

            <div className="space-y-6">
                <PageHeader
                    title="Periodicidad de pagos"
                    description="El orden define cómo aparecen en los selectores de nómina y en Mi empresa."
                    action={
                        <Can permission="payroll_periodicities.index.create">
                            <Link href={route('payroll-periodicities.create')} className="shrink-0">
                                <Button icon={<PlusIcon className="h-4 w-4" />} className="whitespace-nowrap shrink-0">
                                    Nueva periodicidad
                                </Button>
                            </Link>
                        </Can>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            applyFilters({ search: v });
                        }}
                        placeholder="Buscar por codigo o nombre..."
                        className="sm:max-w-xs"
                    />

                    <FilterChips
                        chips={chips}
                        active={filters.status ?? 'all'}
                        onChange={(key) => applyFilters({ status: key })}
                        label="Estado de la periodicidad"
                    />

                    <ViewToggle value={view} onChange={setView} className="sm:ml-auto" />
                </div>

                {rows.length === 0 ? (
                    <EmptyState
                        icon={<CalendarDaysIcon className="h-8 w-8" />}
                        title="No hay periodicidades"
                        description={
                            hasFilters
                                ? 'Ninguna periodicidad coincide con los filtros aplicados.'
                                : 'Crea la primera para poder generar nóminas.'
                        }
                        action={
                            hasFilters ? (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        router.get(route('payroll-periodicities.index'), {}, { replace: true });
                                    }}
                                >
                                    Limpiar filtros
                                </Button>
                            ) : (
                                <Can permission="payroll_periodicities.index.create">
                                    <Link href={route('payroll-periodicities.create')}>
                                        <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva periodicidad</Button>
                                    </Link>
                                </Can>
                            )
                        }
                    />
                ) : view === 'table' ? (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Orden</TableHeader>
                                <TableHeader>Codigo</TableHeader>
                                <TableHeader>Nombre</TableHeader>
                                <TableHeader>Uso en nóminas</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row, index) => (
                                <TableRow key={row.id}>
                                    <TableCell>{canReorder ? reorderButtons(index, row) : <span>—</span>}</TableCell>

                                    <TableCell>
                                        <span className="font-mono text-sm text-indigo-600 dark:text-indigo-300">
                                            {row.code}
                                        </span>
                                    </TableCell>

                                    <TableCell>
                                        <p className="text-[14px] text-[color:var(--emp-text)]">{row.name}</p>
                                        {row.description ? (
                                            <p className="text-[12px] text-[color:var(--emp-muted)]">{row.description}</p>
                                        ) : null}
                                    </TableCell>

                                    <TableCell>
                                        <UsageBar
                                            used={row.payrolls_count ?? 0}
                                            limit={maxPayrolls}
                                            label="Nóminas"
                                            className="min-w-[9rem]"
                                        />
                                    </TableCell>

                                    <TableCell align="center">
                                        {canToggle ? (
                                            <Switch checked={row.is_active} onChange={(v) => toggle(row, v)} />
                                        ) : (
                                            <Badge variant={row.is_active ? 'success' : 'danger'}>
                                                {row.is_active ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        )}
                                    </TableCell>

                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="payroll_periodicities.index.edit">
                                                <Link href={route('payroll-periodicities.edit', row.id)}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<PencilSquareIcon className="h-4 w-4" />}
                                                        aria-label={`Editar ${row.name}`}
                                                    />
                                                </Link>
                                            </Can>
                                            <Can permission="payroll_periodicities.index.delete">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                    onClick={() => setConfirmDelete(row)}
                                                    aria-label={`Eliminar ${row.name}`}
                                                />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
                        <ul className="min-w-0 space-y-2">
                            {rows.map((row, index) => (
                                <li
                                    key={row.id}
                                    className="emp-card flex flex-wrap items-center gap-3 p-3"
                                >
                                    {canReorder ? reorderButtons(index, row) : null}

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14px] text-[color:var(--emp-text)]">{row.name}</p>
                                        <p className="truncate font-mono text-xs text-indigo-600 dark:text-indigo-300">
                                            {row.code}
                                        </p>
                                    </div>

                                    <span className="shrink-0 text-[12px] tabular-nums text-[color:var(--emp-muted)]">
                                        {row.payrolls_count ?? 0} nóminas
                                    </span>

                                    {canToggle ? (
                                        <Switch checked={row.is_active} onChange={(v) => toggle(row, v)} />
                                    ) : (
                                        <Badge variant={row.is_active ? 'success' : 'danger'}>
                                            {row.is_active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    )}

                                    <Can permission="payroll_periodicities.index.edit">
                                        <Link href={route('payroll-periodicities.edit', row.id)}>
                                            <Button variant="outline" size="sm">
                                                Editar
                                            </Button>
                                        </Link>
                                    </Can>
                                </li>
                            ))}
                        </ul>

                        <Can permission="payroll_periodicities.index.create">
                            <QuickCreatePanel />
                        </Can>
                    </div>
                )}

                <Pagination
                    links={periodicities.links}
                    from={periodicities.from}
                    to={periodicities.to}
                    total={periodicities.total}
                />
            </div>

            <ConfirmDialog
                open={!! confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar periodicidad"
                message={
                    confirmDelete
                        ? `Si hay nominas asociadas, el registro se desactivara en lugar de borrarse. Codigo: ${confirmDelete.code}`
                        : ''
                }
                confirmText="Continuar"
                variant="danger"
            />
        </AppLayout>
    );
}

/**
 * Alta rapida junto a la lista.
 *
 * Crear una periodicidad son tres campos; mandar al usuario a otra pantalla y traerlo de
 * vuelta para eso cuesta mas que el propio formulario.
 */
function QuickCreatePanel() {
    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        name: '',
        description: '',
        sort_order: 0,
        is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payroll-periodicities.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <Card className="hidden h-fit xl:block">
            <CardHeader title="Nueva periodicidad" description="El código se genera a partir del nombre." />
            <form onSubmit={submit} className="mt-4 space-y-4">
                <Input
                    label="Nombre visible"
                    value={data.name}
                    onChange={(e) => {
                        setData((current) => ({
                            ...current,
                            name: e.target.value,
                            code: slugifyCode(e.target.value),
                        }));
                    }}
                    error={errors.name}
                    required
                />
                <Input
                    label="Codigo interno"
                    value={data.code}
                    onChange={(e) => setData('code', slugifyCode(e.target.value))}
                    error={errors.code}
                    description="Solo letras minusculas, numeros y guion bajo"
                    required
                />
                <Switch
                    checked={data.is_active}
                    onChange={(v) => setData('is_active', v)}
                    label="Activa al crear"
                    description="Las inactivas no aparecen en selectores nuevos"
                />
                <Button type="submit" loading={processing} fullWidth disabled={data.name === '' || data.code === ''}>
                    Crear periodicidad
                </Button>
            </form>
        </Card>
    );
}
