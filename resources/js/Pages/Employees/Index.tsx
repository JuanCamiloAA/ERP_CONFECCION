import { Head, Link, router, usePage } from '@inertiajs/react';
import { NoSymbolIcon, PencilSquareIcon, PlusIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { RowActionsMenu, type RowAction } from '@/Components/UI/RowActionsMenu';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { Can } from '@/Components/UI/Can';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate, formatNumber } from '@/lib/utils';
import type { Employee, PaginatedResponse } from '@/types';

interface Props {
    employees: PaginatedResponse<Employee>;
    filters: { search: string; status: string };
}

const STATUS_SEGMENTS = [
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'all', label: 'Todos' },
];

/** "2025-03-14" -> "03/2025"; el dia no aporta en el listado. */
function hireMonth(date: string | null | undefined): string {
    if (!date) return '—';
    const [y, m] = String(date).slice(0, 10).split('-');
    return y && m ? `${m}/${y}` : formatDate(date);
}

export default function EmployeesIndex({ employees, filters }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const perms = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);

    const updateFilters = (next: { search?: string; status?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        const newStatus = next.status ?? status;
        if (newSearch) params.search = newSearch;
        if (newStatus !== 'all') params.status = newStatus;

        router.get(route('employees.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('employees.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    const handleDeactivate = () => {
        if (!confirmDeactivate) return;
        router.post(route('employees.deactivate', confirmDeactivate.id), {}, { onFinish: () => setConfirmDeactivate(null) });
    };

    const rowActions = (employee: Employee): RowAction[] => {
        const actions: RowAction[] = [];
        if (perms.can('employees.index.edit')) {
            actions.push({
                key: 'edit',
                label: 'Editar',
                icon: <PencilSquareIcon className="h-4 w-4" />,
                href: route('employees.edit', employee.id),
            });
            if (employee.is_active) {
                actions.push({
                    key: 'deactivate',
                    label: 'Inactivar',
                    icon: <NoSymbolIcon className="h-4 w-4" />,
                    onClick: () => setConfirmDeactivate(employee),
                });
            }
        }
        if (perms.can('employees.index.delete')) {
            actions.push({
                key: 'delete',
                label: 'Eliminar',
                icon: <TrashIcon className="h-4 w-4" />,
                danger: true,
                onClick: () => setConfirmDelete(employee),
            });
        }
        return actions;
    };

    const countLabel = `${formatNumber(employees.total ?? employees.data.length)} ${
        (employees.total ?? employees.data.length) === 1 ? 'empleado' : 'empleados'
    }${status === 'active' ? ' activos' : status === 'inactive' ? ' inactivos' : ''}`;

    return (
        <AppLayout title="Empleados">
            <Head title="Empleados" />

            <div className="space-y-6 pb-24 lg:pb-0">
                <PageHeader
                    title="Empleados"
                    description="Gestiona los empleados del taller y su acceso al sistema."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="employees.index.create">
                                <Link href={route('employees.create')} className="hidden lg:block">
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo empleado</Button>
                                </Link>
                            </Can>
                        ) : undefined
                    }
                />

                {/* Movil: cabecera de filtro pegajosa (busqueda + segmentado de estado). */}
                <div className="sticky top-16 z-10 -mx-4 border-b border-slate-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            updateFilters({ search: v });
                        }}
                        placeholder="Buscar por nombre o documento..."
                        className="[&_input]:h-11"
                    />
                    <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                        {STATUS_SEGMENTS.map((seg) => (
                            <button
                                key={seg.value}
                                type="button"
                                onClick={() => {
                                    setStatus(seg.value);
                                    updateFilters({ status: seg.value });
                                }}
                                className={`h-11 flex-1 text-[13px] transition-colors ${
                                    status === seg.value
                                        ? 'bg-indigo-600 font-semibold text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                {seg.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Escritorio: los mismos controles de siempre. */}
                <div className="hidden flex-col gap-3 sm:flex-row lg:flex">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            updateFilters({ search: v });
                        }}
                        placeholder="Buscar por nombre o documento..."
                        className="sm:max-w-md"
                    />
                    <select
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value);
                            updateFilters({ status: e.target.value });
                        }}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                </div>

                <p className="text-xs text-slate-500 lg:hidden dark:text-slate-400">{countLabel}</p>

                {/* Movil: fila con identidad, metadatos y chips. */}
                <div className="space-y-2 lg:hidden">
                    {employees.data.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            No se encontraron empleados.
                        </div>
                    ) : (
                        employees.data.map((employee) => (
                            <div
                                key={employee.id}
                                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                            >
                                <Avatar src={employee.photo} name={employee.full_name} size="md" className="shrink-0" zoomable />
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={route('employees.show', employee.id)}
                                        className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                                    >
                                        {employee.full_name}
                                    </Link>
                                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {employee.document_type} {employee.document_number} · ingresó {hireMonth(employee.hire_date)}
                                    </p>
                                    {isConsolidatedView && employee.company?.name ? (
                                        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                            {employee.company.name}
                                        </p>
                                    ) : null}
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                        {employee.user_id ? (
                                            <Badge variant="success" size="sm">
                                                <UserIcon className="mr-1 h-3 w-3" /> Con acceso
                                            </Badge>
                                        ) : (
                                            <Badge variant="neutral" size="sm">
                                                Sin acceso
                                            </Badge>
                                        )}
                                        {employee.bank?.name ? (
                                            <Badge variant="neutral" size="sm">
                                                {employee.bank.name}
                                            </Badge>
                                        ) : null}
                                        {employee.bank && !employee.bank.is_active ? (
                                            <Badge variant="warning" size="sm">
                                                Banco inactivo
                                            </Badge>
                                        ) : null}
                                        {!employee.is_active ? (
                                            <Badge variant="danger" size="sm">
                                                Inactivo
                                            </Badge>
                                        ) : null}
                                    </div>
                                </div>
                                <RowActionsMenu actions={rowActions(employee)} />
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden lg:block">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Empleado</TableHeader>
                                {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                                <TableHeader>Documento</TableHeader>
                                <TableHeader>Telefono</TableHeader>
                                <TableHeader>Ingreso</TableHeader>
                                <TableHeader>Banco</TableHeader>
                                <TableHeader>Acceso</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {employees.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isConsolidatedView ? 9 : 8}
                                        className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        No se encontraron empleados.
                                    </td>
                                </tr>
                            ) : (
                                employees.data.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar src={employee.photo} name={employee.full_name} size="sm" zoomable />
                                                <div>
                                                    <Link
                                                        href={route('employees.show', employee.id)}
                                                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                                                    >
                                                        {employee.full_name}
                                                    </Link>
                                                    {employee.email && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{employee.email}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        {isConsolidatedView ? (
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                {employee.company?.name ?? '—'}
                                            </TableCell>
                                        ) : null}
                                        <TableCell>
                                            <span className="text-xs text-slate-500">{employee.document_type}</span>{' '}
                                            {employee.document_number}
                                        </TableCell>
                                        <TableCell>{employee.phone ?? '-'}</TableCell>
                                        <TableCell>{formatDate(employee.hire_date)}</TableCell>
                                        <TableCell className="max-w-[140px] truncate text-sm" title={employee.bank?.name ?? ''}>
                                            {employee.bank?.name ?? '—'}
                                            {employee.bank && !employee.bank.is_active ? (
                                                <span className="block text-xs text-amber-600 dark:text-amber-400">Inactivo</span>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {employee.user_id ? (
                                                <Badge variant="success" size="sm">
                                                    <UserIcon className="mr-1 h-3 w-3" /> Con acceso
                                                </Badge>
                                            ) : (
                                                <Badge variant="neutral" size="sm">
                                                    Sin acceso
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Badge variant={employee.is_active ? 'success' : 'danger'}>
                                                {employee.is_active ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex justify-end gap-1">
                                                <Can permission="employees.index.edit">
                                                    <Link href={route('employees.edit', employee.id)}>
                                                        <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                    </Link>
                                                </Can>
                                                <Can permission="employees.index.edit">
                                                    {employee.is_active ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Inactivar empleado"
                                                            icon={<NoSymbolIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                                                            onClick={() => setConfirmDeactivate(employee)}
                                                        />
                                                    ) : null}
                                                </Can>
                                                <Can permission="employees.index.delete">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                        onClick={() => setConfirmDelete(employee)}
                                                    />
                                                </Can>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination links={employees.links} from={employees.from} to={employees.to} total={employees.total} />
            </div>

            {!isConsolidatedView ? (
                <Can permission="employees.index.create">
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                        <Link href={route('employees.create')} className="block">
                            <Button icon={<PlusIcon className="h-5 w-5" />} fullWidth className="min-h-12 text-base">
                                Nuevo empleado
                            </Button>
                        </Link>
                    </div>
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar empleado"
                message={`Seguro que deseas eliminar a ${confirmDelete?.full_name}? Esta accion no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
            />

            <ConfirmDialog
                open={!!confirmDeactivate}
                onClose={() => setConfirmDeactivate(null)}
                onConfirm={handleDeactivate}
                title="Inactivar empleado"
                message={`Inactivar a ${confirmDeactivate?.full_name}? Dejara de figurar como activo y, si tiene cuenta en el sistema, no podra iniciar sesion. No borra el registro del empleado ni el historial.`}
                confirmText="Inactivar"
                variant="primary"
            />
        </AppLayout>
    );
}
