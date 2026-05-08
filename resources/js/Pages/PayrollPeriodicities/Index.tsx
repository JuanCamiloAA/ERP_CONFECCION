import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { SearchInput } from '@/Components/UI/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import type { PaginatedResponse } from '@/types';

interface PeriodicityRow {
    id: number;
    code: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    payrolls_count: number;
}

interface Props {
    periodicities: PaginatedResponse<PeriodicityRow>;
    filters: { search: string; status: string };
}

export default function PayrollPeriodicitiesIndex({ periodicities, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [confirmDelete, setConfirmDelete] = useState<PeriodicityRow | null>(null);

    const updateFilters = (next: { search?: string; status?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        const newStatus = next.status ?? status;
        if (newSearch) params.search = newSearch;
        if (newStatus !== 'all') params.status = newStatus;
        router.get(route('payroll-periodicities.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('payroll-periodicities.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Periodicidad de pagos">
            <Head title="Periodicidad de pagos" />
            <div className="space-y-6">
                <PageHeader
                    title="Periodicidad de pagos"
                    description="Maestro global usado en nominas y en la configuracion por defecto de la empresa."
                    action={
                        <Can permission="payroll_periodicities.index.create">
                            <Link href={route('payroll-periodicities.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva periodicidad</Button>
                            </Link>
                        </Can>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            updateFilters({ search: v });
                        }}
                        placeholder="Buscar por codigo o nombre..."
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
                            <TableHeader>Orden</TableHeader>
                            <TableHeader>Codigo</TableHeader>
                            <TableHeader>Nombre</TableHeader>
                            <TableHeader align="center">Nominas</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {periodicities.data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No hay registros.
                                </td>
                            </tr>
                        ) : (
                            periodicities.data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="text-slate-500">{row.sort_order}</TableCell>
                                    <TableCell className="font-mono text-sm text-slate-600 dark:text-slate-300">{row.code}</TableCell>
                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{row.name}</TableCell>
                                    <TableCell align="center">{row.payrolls_count ?? 0}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="payroll_periodicities.index.edit">
                                                <Link href={route('payroll-periodicities.edit', row.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="payroll_periodicities.index.delete">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                    onClick={() => setConfirmDelete(row)}
                                                />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination meta={periodicities.meta} links={periodicities.links} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
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
