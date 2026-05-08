import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';
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
import type { PaginatedResponse, Reference } from '@/types';

interface Props {
    references: PaginatedResponse<
        Reference & {
            operations_count: number;
            productions_count: number;
            productions_sum_quantity?: number | null;
            productions_max_per_operation?: number | null;
            operational_cost_per_unit_fixed?: string | number | null;
        }
    >;
    filters: { search: string };
}

export default function ReferencesIndex({ references, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<Reference | null>(null);

    const updateFilters = (s: string) => {
        const params: Record<string, string> = {};
        if (s) params.search = s;
        router.get(route('references.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout title="Referencias">
            <Head title="Referencias" />
            <div className="space-y-6">
                <PageHeader
                    title="Referencias"
                    description="Catalogo de prendas con sus operaciones y precios."
                    action={
                        <Can permission="references.index.create">
                            <Link href={route('references.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva referencia</Button>
                            </Link>
                        </Can>
                    }
                />

                <SearchInput
                    value={search}
                    onChange={(v) => { setSearch(v); updateFilters(v); }}
                    placeholder="Buscar por codigo o nombre..."
                    className="sm:max-w-md"
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Referencia</TableHeader>
                            <TableHeader align="right">Pago u.</TableHeader>
                            <TableHeader align="right">Costo op.</TableHeader>
                            <TableHeader align="center">Operaciones</TableHeader>
                            <TableHeader align="center">Producciones</TableHeader>
                            <TableHeader align="right">Lote (max. op. / total)</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {references.data.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">No hay referencias.</td></tr>
                        ) : (
                            references.data.map((ref) => (
                                <TableRow key={ref.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40">
                                                {ref.image ? (
                                                    <img src={ref.image} alt={ref.name} className="h-10 w-10 rounded-lg object-cover" />
                                                ) : (
                                                    <TagIcon className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div>
                                                <Link href={route('references.show', ref.id)} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100">
                                                    {ref.code}
                                                </Link>
                                                <p className="text-xs text-slate-500">{ref.name}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                        {ref.payment_per_unit != null && ref.payment_per_unit !== '' ? formatCurrency(Number(ref.payment_per_unit)) : '—'}
                                    </TableCell>
                                    <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                        {ref.operational_cost_per_unit_fixed != null && ref.operational_cost_per_unit_fixed !== ''
                                            ? formatCurrency(Number(ref.operational_cost_per_unit_fixed))
                                            : '—'}
                                    </TableCell>
                                    <TableCell align="center">{ref.operations_count}</TableCell>
                                    <TableCell align="center">{ref.productions_count}</TableCell>
                                    <TableCell align="right" className="whitespace-nowrap text-xs tabular-nums">
                                        {ref.lot_total_quantity != null ? (
                                            <>
                                                {Number(ref.productions_max_per_operation ?? 0).toLocaleString()} /{' '}
                                                {ref.lot_total_quantity.toLocaleString()}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Badge variant={ref.is_active ? 'success' : 'danger'}>{ref.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="references.index.edit">
                                                <Link href={route('references.edit', ref.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="references.index.delete">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                    onClick={() => setConfirmDelete(ref)}
                                                />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={references.links} from={references.from} to={references.to} total={references.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('references.destroy', confirmDelete.id), {
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar referencia"
                message={`Eliminar la referencia ${confirmDelete?.code}?`}
                variant="danger"
            />
        </AppLayout>
    );
}
