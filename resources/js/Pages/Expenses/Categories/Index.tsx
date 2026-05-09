import { Head, Link, router, usePage } from '@inertiajs/react';
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
import type { ExpenseCategory, PaginatedResponse } from '@/types';

interface Props {
    categories: PaginatedResponse<ExpenseCategory & { expenses_count: number }>;
    filters: { search: string };
}

export default function ExpenseCategoriesIndex({ categories, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<ExpenseCategory | null>(null);
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;

    const updateFilters = (next: { search?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        if (newSearch) params.search = newSearch;
        router.get(route('expense-categories.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('expense-categories.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Categorias de gastos">
            <Head title="Categorias de gastos" />
            <div className="space-y-6">
                <PageHeader
                    title="Categorias de gastos"
                    description="Catalogo por empresa para clasificar gastos."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="expenses.categories.create">
                                <Link href={route('expense-categories.create')}>
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva categoria</Button>
                                </Link>
                            </Can>
                        ) : undefined
                    }
                />

                <SearchInput
                    value={search}
                    onChange={(v) => {
                        setSearch(v);
                        updateFilters({ search: v });
                    }}
                    placeholder="Buscar por nombre..."
                    className="max-w-md"
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Nombre</TableHeader>
                                {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                                <TableHeader>Descripcion</TableHeader>
                                <TableHeader>Gastos</TableHeader>
                                <TableHeader>Estado</TableHeader>
                                <TableHeader className="w-28 text-right">Orden</TableHeader>
                                <TableHeader className="w-32 text-right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {categories.data.map((row) => (
                                    <TableRow key={row.id}>
                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{row.name}</TableCell>
                                    {isConsolidatedView ? (
                                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                            {row.company?.name ?? '—'}
                                        </TableCell>
                                    ) : null}
                                    <TableCell className="max-w-md truncate text-sm text-slate-600 dark:text-slate-400">
                                        {row.description ?? '—'}
                                    </TableCell>
                                    <TableCell>{row.expenses_count ?? 0}</TableCell>
                                    <TableCell>
                                        {row.is_active ? (
                                            <Badge variant="success">Activa</Badge>
                                        ) : (
                                            <Badge variant="neutral">Inactiva</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{row.sort_order}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="expenses.categories.edit">
                                                {!isConsolidatedView ? (
                                                    <Link href={route('expense-categories.edit', row.id)}>
                                                        <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                    </Link>
                                                ) : null}
                                            </Can>
                                            <Can permission="expenses.categories.delete">
                                                {!isConsolidatedView ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<TrashIcon className="h-4 w-4 text-rose-600" />}
                                                        onClick={() => setConfirmDelete(row)}
                                                    />
                                                ) : null}
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {categories.data.length === 0 ? (
                        <p className="p-8 text-center text-sm text-slate-500">Sin categorias. Cree la primera para registrar gastos.</p>
                    ) : null}
                    <Pagination links={categories.links} from={categories.from} to={categories.to} total={categories.total} />
                </div>
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar categoria"
                message={
                    confirmDelete ? `¿Eliminar "${confirmDelete.name}"? No se puede si tiene gastos asociados.` : ''
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
