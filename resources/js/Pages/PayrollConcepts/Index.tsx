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
import type { PaginatedResponse, PayrollConcept } from '@/types';

interface Props {
    concepts: PaginatedResponse<PayrollConcept & { adjustments_count: number }>;
    filters: { search: string };
}

export default function PayrollConceptsIndex({ concepts, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmDelete, setConfirmDelete] = useState<PayrollConcept | null>(null);
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;

    const updateFilters = (next: { search?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        if (newSearch) params.search = newSearch;
        router.get(route('payroll-concepts.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('payroll-concepts.destroy', confirmDelete.id), {
            onFinish: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Conceptos de nomina">
            <Head title="Conceptos de nomina" />
            <div className="space-y-6">
                <PageHeader
                    title="Conceptos de nomina"
                    description="Catalogo por empresa para bonificaciones y ajustes positivos en nominas."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="payroll_concepts.index.create">
                                <Link href={route('payroll-concepts.create')}>
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo concepto</Button>
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
                    placeholder="Buscar por nombre o codigo..."
                    className="max-w-md"
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Nombre</TableHeader>
                                {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                                <TableHeader>Codigo</TableHeader>
                                <TableHeader>Uso en nominas</TableHeader>
                                <TableHeader>Estado</TableHeader>
                                <TableHeader className="w-28 text-right">Orden</TableHeader>
                                <TableHeader className="w-32 text-right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {concepts.data.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{row.name}</TableCell>
                                    {isConsolidatedView ? (
                                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                            {row.company?.name ?? '—'}
                                        </TableCell>
                                    ) : null}
                                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{row.code ?? '—'}</TableCell>
                                    <TableCell>{row.adjustments_count ?? 0}</TableCell>
                                    <TableCell>
                                        {row.is_active ? (
                                            <Badge variant="success">Activo</Badge>
                                        ) : (
                                            <Badge variant="neutral">Inactivo</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{row.sort_order ?? 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {!isConsolidatedView ? (
                                                <>
                                                    <Can permission="payroll_concepts.index.edit">
                                                        <Link href={route('payroll-concepts.edit', row.id)}>
                                                            <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />}>
                                                                Editar
                                                            </Button>
                                                        </Link>
                                                    </Can>
                                                    <Can permission="payroll_concepts.index.delete">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<TrashIcon className="h-4 w-4" />}
                                                            onClick={() => setConfirmDelete(row)}
                                                        >
                                                            Eliminar
                                                        </Button>
                                                    </Can>
                                                </>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <Pagination links={concepts.links} from={concepts.from} to={concepts.to} total={concepts.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar concepto"
                message="¿Eliminar este concepto? Solo es posible si no hay ajustes asociados en nominas."
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
