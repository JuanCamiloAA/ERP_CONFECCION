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
import type { Bank, PaginatedResponse } from '@/types';

interface Props {
    banks: PaginatedResponse<Bank & { employees_count: number }>;
    filters: { search: string; status: string };
}

export default function BanksIndex({ banks, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [confirmDelete, setConfirmDelete] = useState<Bank | null>(null);

    const updateFilters = (next: { search?: string; status?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        const newStatus = next.status ?? status;
        if (newSearch) params.search = newSearch;
        if (newStatus !== 'all') params.status = newStatus;
        router.get(route('banks.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('banks.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Bancos">
            <Head title="Bancos" />
            <div className="space-y-6">
                <PageHeader
                    title="Bancos"
                    description="Catalogo de bancos para datos de pago de empleados."
                    action={
                        <Can permission="banks.index.create">
                            <Link href={route('banks.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo banco</Button>
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
                        placeholder="Buscar por nombre o codigo..."
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
                            <TableHeader>Codigo</TableHeader>
                            <TableHeader>Nombre</TableHeader>
                            <TableHeader align="center">Empleados</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {banks.data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No hay bancos registrados.
                                </td>
                            </tr>
                        ) : (
                            banks.data.map((b) => (
                                <TableRow key={b.id}>
                                    <TableCell className="text-slate-500">{b.code ?? '—'}</TableCell>
                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{b.name}</TableCell>
                                    <TableCell align="center">{b.employees_count ?? 0}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={b.is_active ? 'success' : 'danger'}>{b.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="banks.index.edit">
                                                <Link href={route('banks.edit', b.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="banks.index.delete">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                    onClick={() => setConfirmDelete(b)}
                                                />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={banks.links} from={banks.from} to={banks.to} total={banks.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar o desactivar banco"
                message={`Si hay empleados usando "${confirmDelete?.name}", el banco se desactivara en lugar de borrarse.`}
                confirmText="Continuar"
                variant="danger"
            />
        </AppLayout>
    );
}
