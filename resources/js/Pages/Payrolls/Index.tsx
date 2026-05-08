import { Head, Link, router } from '@inertiajs/react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Select } from '@/Components/UI/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PaginatedResponse, Payroll } from '@/types';

interface Props {
    payrolls: PaginatedResponse<Payroll>;
    filters: { status: string; year: number };
}

const statusVariant: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
    borrador: 'neutral',
    calculado: 'info',
    aprobado: 'warning',
    pagado: 'success',
};

export default function PayrollsIndex({ payrolls, filters }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<Payroll | null>(null);
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [year, setYear] = useState(filters.year ?? new Date().getFullYear());

    const apply = () => {
        const params: Record<string, string | number> = { year };
        if (status !== 'all') params.status = status;
        router.get(route('payrolls.index'), params, { preserveState: true, replace: true });
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <AppLayout title="Nominas">
            <Head title="Nominas" />
            <div className="space-y-6">
                <PageHeader
                    title="Nominas"
                    description="Periodos de nomina de la empresa."
                    action={
                        <Can permission="payrolls.index.create">
                            <Link href={route('payrolls.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva nomina</Button>
                            </Link>
                        </Can>
                    }
                />

                <div className="flex flex-wrap gap-3">
                    <Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        options={[
                            { value: 'all', label: 'Todos los estados' },
                            { value: 'borrador', label: 'Borrador' },
                            { value: 'calculado', label: 'Calculado' },
                            { value: 'aprobado', label: 'Aprobado' },
                            { value: 'pagado', label: 'Pagado' },
                        ]}
                        className="sm:max-w-xs"
                    />
                    <Select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        className="sm:max-w-[140px]"
                    />
                    <Button onClick={apply}>Filtrar</Button>
                </div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Nomina</TableHeader>
                            <TableHeader>Periodo</TableHeader>
                            <TableHeader align="center">Tipo</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Total</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {payrolls.data.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No hay nominas.</td></tr>
                        ) : payrolls.data.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell>
                                    <Link href={route('payrolls.show', p.id)} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100">
                                        {p.name}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    {formatDate(p.period_start)} - {formatDate(p.period_end)}
                                </TableCell>
                                <TableCell align="center" className="capitalize">{p.type}</TableCell>
                                <TableCell align="center">
                                    <Badge variant={statusVariant[p.status] ?? 'neutral'}>{p.status}</Badge>
                                </TableCell>
                                <TableCell align="right" className="font-semibold">{formatCurrency(p.total_amount)}</TableCell>
                                <TableCell align="right">
                                    <Can permission="payrolls.index.delete">
                                        {p.status !== 'pagado' && p.status !== 'aprobado' && (
                                            <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(p)} />
                                        )}
                                    </Can>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Pagination links={payrolls.links} from={payrolls.from} to={payrolls.to} total={payrolls.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('payrolls.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title="Eliminar nomina"
                message={`Eliminar la nomina "${confirmDelete?.name}"?`}
            />
        </AppLayout>
    );
}
