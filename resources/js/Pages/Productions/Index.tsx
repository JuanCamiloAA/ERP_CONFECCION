import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChartBarIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import type { ReferenceWithOps } from '@/Components/Productions/ProductionRegisterForm';
import { ProductionRegisterForm } from '@/Components/Productions/ProductionRegisterForm';
import { Card } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Badge } from '@/Components/UI/Badge';
import { Select } from '@/Components/UI/Select';
import { Input } from '@/Components/UI/Input';
import { Table, TableBody, TableCell, TableFoot, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { WorkDayBanner, type WorkDayBannerPayload } from '@/Components/Productions/WorkDayBanner';
import type { Employee, Operation, PaginatedResponse, Production, Reference } from '@/types';

interface Props {
    productions: PaginatedResponse<Production>;
    filters: {
        employee_id: number | null;
        reference_id: number | null;
        operation_id: number | null;
        date_start: string | null;
        date_end: string | null;
        shift: string | null;
        status: string | null;
    };
    totals: { total_quantity: number; total_value: number };
    employees: Employee[];
    references: Reference[];
    operations: Operation[];
    workerMode?: boolean;
    lockedEmployee?: { id: number; name: string; payroll_mode?: string } | null;
    referencesWithOperations?: ReferenceWithOps[];
    workDayBanner?: WorkDayBannerPayload | null;
    workDaySelectableEmployees?: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
}

export default function ProductionsIndex({
    productions,
    filters,
    totals,
    employees,
    references,
    operations,
    workerMode = false,
    lockedEmployee = null,
    referencesWithOperations = [],
    workDayBanner = null,
    workDaySelectableEmployees = [],
}: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const [localFilters, setLocalFilters] = useState({
        employee_id: filters.employee_id ?? '',
        reference_id: filters.reference_id ?? '',
        operation_id: filters.operation_id ?? '',
        date_start: filters.date_start ?? '',
        date_end: filters.date_end ?? '',
        shift: filters.shift ?? '',
        status: filters.status ?? '',
    });
    const [confirmDelete, setConfirmDelete] = useState<Production | null>(null);

    const apply = () => {
        const params: Record<string, string> = {};
        Object.entries(localFilters).forEach(([k, v]) => {
            if (v) params[k] = String(v);
        });
        router.get(route('productions.index'), params, { preserveState: true, replace: true });
    };

    const reset = () => {
        setLocalFilters({ employee_id: '', reference_id: '', operation_id: '', date_start: '', date_end: '', shift: '', status: '' });
        router.get(route('productions.index'), {}, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title="Produccion">
            <Head title="Produccion" />
            <div className="space-y-6">
                <PageHeader
                    title={workerMode ? 'Mi produccion' : 'Produccion'}
                    description={
                        workerMode
                            ? 'Registra lo producido; tus registros recientes aparecen abajo.'
                            : 'Registro diario de produccion por empleado.'
                    }
                    action={
                        <div className="flex gap-2">
                            <Can permission="productions.report.view">
                                <Link href={route('productions.report')}>
                                    <Button variant="outline" icon={<ChartBarIcon className="h-4 w-4" />}>
                                        Reporte
                                    </Button>
                                </Link>
                            </Can>
                            {!workerMode && (
                                <Can permission="productions.index.create">
                                    {!isConsolidatedView ? (
                                        <Link href={route('productions.create')}>
                                            <Button icon={<PlusIcon className="h-4 w-4" />}>Registrar</Button>
                                        </Link>
                                    ) : null}
                                </Can>
                            )}
                        </div>
                    }
                />

                {workDayBanner && workerMode ? (
                    <Can any={['productions.index.workday_start', 'productions.index.workday_close']}>
                        <WorkDayBanner variant="self" initialSelf={workDayBanner} />
                    </Can>
                ) : null}
                {!workerMode && workDaySelectableEmployees.length > 0 ? (
                    <Can any={['productions.index.workday_start', 'productions.index.workday_close']}>
                        <WorkDayBanner variant="admin" selectableEmployees={workDaySelectableEmployees} />
                    </Can>
                ) : null}

                {workerMode && !lockedEmployee && (
                    <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
                        Tu cuenta no tiene un empleado vinculado. No puedes registrar produccion hasta que un administrador lo asocie.
                    </Card>
                )}
                {workerMode && lockedEmployee && referencesWithOperations.length > 0 && (
                    <ProductionRegisterForm
                        references={referencesWithOperations}
                        lockedEmployeeId={lockedEmployee.id}
                        lockedEmployeeName={lockedEmployee.name}
                        submitButtonText="Registrar produccion"
                    />
                )}
                {workerMode && lockedEmployee && referencesWithOperations.length === 0 && (
                    <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                        No hay referencias activas configuradas. Contacta a administracion para poder registrar produccion.
                    </Card>
                )}

                <Card>
                    {!workerMode && <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Filtros</p>}
                    {workerMode && <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Buscar en mis registros</p>}
                    <div
                        className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${workerMode ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}
                    >
                        {!workerMode && (
                            <Select
                                label="Empleado"
                                value={localFilters.employee_id}
                                onChange={(e) => setLocalFilters({ ...localFilters, employee_id: e.target.value })}
                                options={employees.map((e) => ({
                                    value: e.id,
                                    label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                                }))}
                                placeholder="Todos"
                            />
                        )}
                        <Select
                            label="Referencia"
                            value={localFilters.reference_id}
                            onChange={(e) => setLocalFilters({ ...localFilters, reference_id: e.target.value })}
                            options={references.map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }))}
                            placeholder="Todas"
                        />
                        <Select
                            label="Operacion"
                            value={localFilters.operation_id}
                            onChange={(e) => setLocalFilters({ ...localFilters, operation_id: e.target.value })}
                            options={operations.map((o) => ({ value: o.id, label: o.name }))}
                            placeholder="Todas"
                        />
                        <Input label="Desde" type="date" value={localFilters.date_start} onChange={(e) => setLocalFilters({ ...localFilters, date_start: e.target.value })} />
                        <Input label="Hasta" type="date" value={localFilters.date_end} onChange={(e) => setLocalFilters({ ...localFilters, date_end: e.target.value })} />
                        {workerMode ? (
                            <Select
                                label="Estado"
                                value={localFilters.status}
                                onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                                options={[
                                    { value: 'pendiente', label: 'Pendiente' },
                                    { value: 'confirmado', label: 'Confirmado' },
                                ]}
                                placeholder="Todos"
                            />
                        ) : (
                            <Select
                                label="Turno"
                                value={localFilters.shift}
                                onChange={(e) => setLocalFilters({ ...localFilters, shift: e.target.value })}
                                options={[
                                    { value: 'manana', label: 'Manana' },
                                    { value: 'tarde', label: 'Tarde' },
                                    { value: 'noche', label: 'Noche' },
                                ]}
                                placeholder="Todos"
                            />
                        )}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={reset}>Limpiar</Button>
                        <Button onClick={apply}>Filtrar</Button>
                    </div>
                </Card>

                {workerMode && (
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Mis registros</h2>
                )}

                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Fecha</TableHeader>
                            {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                            <TableHeader>Empleado</TableHeader>
                            <TableHeader>Referencia</TableHeader>
                            <TableHeader>Operacion</TableHeader>
                            <TableHeader align="right">Cantidad</TableHeader>
                            <TableHeader align="right">Precio</TableHeader>
                            <TableHeader align="right">Valor</TableHeader>
                            <TableHeader align="center">Turno</TableHeader>
                            <TableHeader align="center">Estado</TableHeader>
                            <TableHeader align="right">Acciones</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {productions.data.length === 0 ? (
                            <tr><td colSpan={isConsolidatedView ? 11 : 10} className="px-4 py-12 text-center text-sm text-slate-500">No hay registros.</td></tr>
                        ) : (
                            productions.data.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>{formatDate(p.date)}</TableCell>
                                    {isConsolidatedView ? (
                                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                            {p.company?.name ?? '—'}
                                        </TableCell>
                                    ) : null}
                                    <TableCell>{p.employee?.first_name} {p.employee?.last_name}</TableCell>
                                    <TableCell>{p.reference?.code} <span className="text-xs text-slate-500">{p.reference?.name}</span></TableCell>
                                    <TableCell>{p.operation?.name}</TableCell>
                                    <TableCell align="right">{formatNumber(p.quantity)}</TableCell>
                                    <TableCell align="right">{formatCurrency(p.unit_price)}</TableCell>
                                    <TableCell align="right" className="font-medium">{formatCurrency(p.total_value)}</TableCell>
                                    <TableCell align="center" className="capitalize">{p.shift}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={p.status === 'pendiente' ? 'warning' : 'success'}>{p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}</Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Can permission="productions.index.edit">
                                                <Link href={route('productions.edit', p.id)}>
                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                </Link>
                                            </Can>
                                            <Can permission="productions.index.delete">
                                                <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => setConfirmDelete(p)} />
                                            </Can>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                    {productions.data.length > 0 && (
                        <TableFoot>
                            <tr>
                                <td colSpan={isConsolidatedView ? 5 : 4} className="px-4 py-3 text-right text-xs uppercase text-slate-500">Totales</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(totals.total_quantity)}</td>
                                <td />
                                <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(totals.total_value)}</td>
                                <td colSpan={3} />
                            </tr>
                        </TableFoot>
                    )}
                </Table>

                <Pagination links={productions.links} from={productions.from} to={productions.to} total={productions.total} />
            </div>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('productions.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title="Eliminar registro de produccion"
                message="Esta accion no se puede deshacer."
            />
        </AppLayout>
    );
}
