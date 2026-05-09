import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowTopRightOnSquareIcon, EyeIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
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
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { ExpenseListRow, PaginatedResponse } from '@/types';

interface CategoryOption {
    id: number;
    name: string;
}

interface Props {
    expenses: PaginatedResponse<ExpenseListRow>;
    categoryOptions: CategoryOption[];
    filters: {
        search: string;
        category_id: string | number | null;
        date_from: string | null;
        date_to: string | null;
    };
}

export default function ExpensesIndex({ expenses, categoryOptions, filters }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id === null ? '' : String(filters.category_id));
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [confirmDelete, setConfirmDelete] = useState<ExpenseListRow | null>(null);

    const applyFilters = (next: Partial<{ search: string; category_id: string; date_from: string; date_to: string }>) => {
        const params: Record<string, string> = {};
        const s = next.search ?? search;
        const c = next.category_id !== undefined ? next.category_id : categoryId;
        const df = next.date_from !== undefined ? next.date_from : dateFrom;
        const dt = next.date_to !== undefined ? next.date_to : dateTo;
        if (s) params.search = s;
        if (c) params.category_id = c;
        if (df) params.date_from = df;
        if (dt) params.date_to = dt;
        router.get(route('expenses.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const receiptLabel = (mime: string | null) => {
        if (!mime) return '—';
        if (mime.includes('pdf')) return 'PDF';
        return 'Imagen';
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('expenses.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Gastos">
            <Head title="Gastos" />
            <div className="space-y-6">
                <PageHeader
                    title="Gastos"
                    description="Registro de gastos con comprobante y categoría por empresa."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="expenses.index.create">
                                <Link href={route('expenses.create')}>
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Registrar gasto</Button>
                                </Link>
                            </Can>
                        ) : undefined
                    }
                />

                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            applyFilters({ search: v });
                        }}
                        placeholder="Buscar en descripcion..."
                        className="max-w-md"
                    />
                    <select
                        value={categoryId}
                        onChange={(e) => {
                            const v = e.target.value;
                            setCategoryId(v);
                            applyFilters({ category_id: v });
                        }}
                        className="h-10 max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                        <option value="">Todas las categorias</option>
                        {categoryOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                            Desde
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    applyFilters({ date_from: e.target.value });
                                }}
                                className="ml-1 h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </label>
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                            Hasta
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value);
                                    applyFilters({ date_to: e.target.value });
                                }}
                                className="ml-1 h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                            />
                        </label>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Fecha gasto</TableHeader>
                                <TableHeader>Registrado</TableHeader>
                                {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                                <TableHeader>Categoria</TableHeader>
                                <TableHeader>Monto</TableHeader>
                                <TableHeader>Descripcion</TableHeader>
                                <TableHeader>Comprobante</TableHeader>
                                <TableHeader className="text-right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {expenses.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isConsolidatedView ? 8 : 7} className="py-8 text-center text-slate-500">
                                        No hay gastos con los filtros actuales.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                expenses.data.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="whitespace-nowrap">{formatDate(row.expense_date)}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm text-slate-500">
                                            {row.created_at ? formatDateTime(row.created_at) : '—'}
                                        </TableCell>
                                        {isConsolidatedView ? (
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                {row.company?.name ?? '—'}
                                            </TableCell>
                                        ) : null}
                                        <TableCell>{row.category?.name ?? '—'}</TableCell>
                                        <TableCell className="font-medium">{formatCurrency(row.amount)}</TableCell>
                                        <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                                        <TableCell>
                                            {row.receipt_url ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="info">{receiptLabel(row.receipt_mime)}</Badge>
                                                    <a
                                                        href={row.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                                                    >
                                                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                                    </a>
                                                </div>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Can permission="expenses.index.view">
                                                    <Link href={route('expenses.show', row.id)}>
                                                        <Button variant="ghost" size="sm" icon={<EyeIcon className="h-4 w-4" />} />
                                                    </Link>
                                                </Can>
                                                <Can permission="expenses.index.edit">
                                                    {!isConsolidatedView ? (
                                                        <Link href={route('expenses.edit', row.id)}>
                                                            <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                        </Link>
                                                    ) : null}
                                                </Can>
                                                <Can permission="expenses.index.delete">
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <Pagination links={expenses.links} from={expenses.from} to={expenses.to} total={expenses.total} />
                </div>
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar gasto"
                message={confirmDelete ? 'El gasto se archivara (eliminacion suave). ¿Continuar?' : ''}
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
