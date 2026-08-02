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

interface WidgetRow {
    id: number;
    name: string;
    title: string;
    type: string;
    query_mode: 'builder' | 'sql';
    is_active: boolean;
    visibility_count: number;
}

interface Props {
    widgets: PaginatedResponse<WidgetRow>;
}

const typeLabels: Record<string, string> = {
    kpi: 'KPI',
    bar: 'Barras',
    line: 'Lineas',
    pie: 'Torta',
    table: 'Tabla',
};

export default function DashboardWidgetsIndex({ widgets }: Props) {
    const [confirm, setConfirm] = useState<WidgetRow | null>(null);

    const destroy = () => {
        if (!confirm) return;
        router.delete(route('super-admin.dashboard-widgets.destroy', confirm.id), { onFinish: () => setConfirm(null) });
    };

    return (
        <AppLayout title="Constructor de dashboards">
            <Head title="Constructor de dashboards" />
            <div className="space-y-6">
                <PageHeader
                    title="Constructor de dashboards"
                    description="Widgets dinamicos que se muestran en el Dashboard de empresas y roles seleccionados."
                    action={
                        <Link href={route('super-admin.dashboard-widgets.create')}>
                            <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo widget</Button>
                        </Link>
                    }
                />

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Widget</TableHeader>
                            <TableHeader align="center">Tipo</TableHeader>
                            <TableHeader align="center">Consulta</TableHeader>
                            <TableHeader align="center">Asignaciones</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {widgets.data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                                    Aun no hay widgets. Crea el primero.
                                </td>
                            </tr>
                        ) : (
                            widgets.data.map((w) => (
                                <TableRow key={w.id}>
                                    <TableCell>
                                        <div className="font-medium text-slate-900 dark:text-slate-100">{w.title}</div>
                                        <div className="text-xs text-slate-500">{w.name}</div>
                                    </TableCell>
                                    <TableCell align="center">{typeLabels[w.type] ?? w.type}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={w.query_mode === 'sql' ? 'warning' : 'info'}>
                                            {w.query_mode === 'sql' ? 'SQL avanzado' : 'Guiado'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="center">{w.visibility_count}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={w.is_active ? 'success' : 'danger'}>{w.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={route('super-admin.dashboard-widgets.edit', w.id)}>
                                                <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                onClick={() => setConfirm(w)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination links={widgets.links} from={widgets.from} to={widgets.to} total={widgets.total} />
            </div>

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={destroy}
                title="Eliminar widget"
                message="Se eliminaran tambien todas sus asignaciones de visibilidad por empresa y rol."
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
