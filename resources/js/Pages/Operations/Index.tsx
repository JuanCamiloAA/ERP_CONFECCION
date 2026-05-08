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
import { formatCurrency } from '@/lib/utils';
import type { Operation, PaginatedResponse } from '@/types';

interface Props {
    operations: PaginatedResponse<Operation & { references_count: number; productions_count: number }>;
    filters: { search: string };
}

export default function OperationsIndex({ operations, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<Operation | null>(null);

    const updateFilters = (s: string) => {
        const params: Record<string, string> = {};
        if (s) params.search = s;
        router.get(route('operations.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout title="Operaciones">
            <Head title="Operaciones" />
            <div className="space-y-6">
                <PageHeader
                    title="Operaciones"
                    description="Listado de operaciones de confeccion."
                    action={
                        <Can permission="operations.index.create">
                            <Link href={route('operations.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva operacion</Button>
                            </Link>
                        </Can>
                    }
                />

                <SearchInput
                    value={search}
                    onChange={(v) => { setSearch(v); updateFilters(v); }}
                    placeholder="Buscar operacion..."
                    className="sm:max-w-md"
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Operacion</TableHeader>
                            <TableHeader align="right">Precio base</TableHeader>
                            <TableHeader align="center">Referencias</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {operations.data.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No hay operaciones.</td></tr>
                        ) : (
                            operations.data.map((op) => (
                                <TableRow key={op.id}>
                                    <TableCell>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">{op.name}</p>
                                        {op.description && <p className="text-xs text-slate-500">{op.description}</p>}
                                    </TableCell>
                                    <TableCell align="right" className="font-medium">{formatCurrency(op.base_price)}</TableCell>
                                    <TableCell align="center">{op.references_count}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={op.is_active ? 'success' : 'danger'}>{op.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="operations.index.edit">
                                                <Link href={route('operations.edit', op.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="operations.index.delete">
                                                <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(op)} />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={operations.links} from={operations.from} to={operations.to} total={operations.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('operations.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title="Eliminar operacion"
                message={`Eliminar "${confirmDelete?.name}"?`}
            />
        </AppLayout>
    );
}
