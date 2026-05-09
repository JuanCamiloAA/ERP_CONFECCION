import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import type { PaginatedResponse } from '@/types';

interface PlanRow {
    id: number;
    name: string;
    slug: string;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly: string | null;
    is_active: boolean;
    sort_order: number;
    companies_count: number;
}

interface Props {
    plans: PaginatedResponse<PlanRow>;
}

export default function MembershipPlansIndex({ plans }: Props) {
    const [confirm, setConfirm] = useState<PlanRow | null>(null);

    const destroy = () => {
        if (!confirm) return;
        router.delete(route('super-admin.membership-plans.destroy', confirm.id), { onFinish: () => setConfirm(null) });
    };

    const fmtStaff = (n: number | null) => (n === null ? 'Ilimitado' : String(n));
    const fmtEmp = (n: number | null) => (n === null ? 'Ilimitado' : String(n));

    return (
        <AppLayout title="Planes de membresia">
            <Head title="Planes de membresia" />
            <div className="space-y-6">
                <PageHeader
                    title="Planes de membresia"
                    description="Limites de usuarios staff y empleados por plan."
                    action={
                        <Link href={route('super-admin.membership-plans.create')}>
                            <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo plan</Button>
                        </Link>
                    }
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Plan</TableHeader>
                            <TableHeader align="center">Staff max</TableHeader>
                            <TableHeader align="center">Empleados max</TableHeader>
                            <TableHeader align="right">Precio / mes</TableHeader>
                            <TableHeader align="center">Empresas</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {plans.data.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                                    No hay planes. Crea uno o ejecuta LandingSeeder.
                                </td>
                            </tr>
                        ) : (
                            plans.data.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.slug}</div>
                                    </TableCell>
                                    <TableCell align="center">{fmtStaff(p.max_staff_users)}</TableCell>
                                    <TableCell align="center">{fmtEmp(p.max_employees)}</TableCell>
                                    <TableCell align="right">{p.price_monthly != null ? `$${p.price_monthly}` : '-'}</TableCell>
                                    <TableCell align="center">{p.companies_count}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={route('super-admin.membership-plans.edit', p.id)}>
                                                <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                            </Link>
                                            <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirm(p)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={plans.links} from={plans.from} to={plans.to} total={plans.total} />
            </div>

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={destroy}
                title="Eliminar plan"
                message="Las empresas con este plan quedaran sin plan asignado."
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
