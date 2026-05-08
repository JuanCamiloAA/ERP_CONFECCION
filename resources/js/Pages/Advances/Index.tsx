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
import type { Advance, Employee, PaginatedResponse } from '@/types';

interface Props {
    advances: PaginatedResponse<Advance>;
    filters: { status: string; employee_id: number | null };
    employees: Employee[];
}

export default function AdvancesIndex({ advances, filters, employees }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<Advance | null>(null);
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [employeeId, setEmployeeId] = useState(filters.employee_id ?? '');

    const apply = () => {
        const params: Record<string, string | number> = {};
        if (status !== 'all') params.status = status;
        if (employeeId) params.employee_id = employeeId;
        router.get(route('advances.index'), params, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title="Anticipos">
            <Head title="Anticipos" />
            <div className="space-y-6">
                <PageHeader
                    title="Anticipos"
                    description="Pagos anticipados a empleados que se descuentan en la siguiente nomina."
                    action={
                        <Can permission="advances.index.create">
                            <Link href={route('advances.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo anticipo</Button>
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
                            { value: 'pendiente', label: 'Pendientes' },
                            { value: 'descontado', label: 'Descontados' },
                        ]}
                        className="sm:max-w-xs"
                    />
                    <Select
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        options={employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                        placeholder="Todos los empleados"
                        className="sm:max-w-xs"
                    />
                    <Button onClick={apply}>Filtrar</Button>
                </div>

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Fecha</TableHeader>
                            <TableHeader>Empleado</TableHeader>
                            <TableHeader>Motivo</TableHeader>
                            <TableHeader align="right">Monto</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {advances.data.length === 0 ? (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No hay anticipos.</td></tr>
                        ) : advances.data.map((a) => (
                            <TableRow key={a.id}>
                                <TableCell>{formatDate(a.date)}</TableCell>
                                <TableCell>{a.employee?.first_name} {a.employee?.last_name}</TableCell>
                                <TableCell>{a.reason}</TableCell>
                                <TableCell align="right" className="font-medium">{formatCurrency(a.amount)}</TableCell>
                                <TableCell align="center">
                                    <Badge variant={a.status === 'descontado' ? 'success' : 'warning'}>{a.status}</Badge>
                                </TableCell>
                                <TableCell align="right">
                                    <Can permission="advances.index.delete">
                                        {a.status === 'pendiente' && (
                                            <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(a)} />
                                        )}
                                    </Can>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Pagination links={advances.links} from={advances.from} to={advances.to} total={advances.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('advances.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title="Eliminar anticipo"
                message="Solo se pueden eliminar anticipos pendientes."
            />
        </AppLayout>
    );
}
