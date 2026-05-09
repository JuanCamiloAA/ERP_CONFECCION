import { Head, Link, router, usePage } from '@inertiajs/react';
import { NoSymbolIcon, PencilSquareIcon, PlusIcon, TrashIcon, UserIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate } from '@/lib/utils';
import type { Employee, PaginatedResponse } from '@/types';

interface Props {
    employees: PaginatedResponse<Employee>;
    filters: { search: string; status: string };
}

export default function EmployeesIndex({ employees, filters }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
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

    return (
        <AppLayout title="Empleados">
            <Head title="Empleados" />

            <div className="space-y-6">
                <PageHeader
                    title="Empleados"
                    description="Gestiona los empleados del taller y su acceso al sistema."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="employees.index.create">
                                <Link href={route('employees.create')}>
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo empleado</Button>
                                </Link>
                            </Can>
                        ) : undefined
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
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
                                <td colSpan={isConsolidatedView ? 9 : 8} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No se encontraron empleados.
                                </td>
                            </tr>
                        ) : (
                            employees.data.map((employee) => (
                                <TableRow key={employee.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar src={employee.photo} name={employee.full_name} size="sm" />
                                            <div>
                                                <Link href={route('employees.show', employee.id)} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100">
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
                                            <Badge variant="neutral" size="sm">Sin acceso</Badge>
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

                <Pagination
                    links={employees.links}
                    from={employees.from}
                    to={employees.to}
                    total={employees.total}
                />
            </div>

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
