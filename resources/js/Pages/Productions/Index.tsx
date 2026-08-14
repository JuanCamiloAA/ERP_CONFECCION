import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AdjustmentsHorizontalIcon,
    ChartBarIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    TrophyIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import type { ReferenceWithOps } from '@/Components/Productions/ProductionRegisterForm';
import { ProductionRegisterForm } from '@/Components/Productions/ProductionRegisterForm';
import { Card } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Modal } from '@/Components/UI/Modal';
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

type FilterKey = 'employee_id' | 'reference_id' | 'operation_id' | 'date_start' | 'date_end' | 'shift' | 'status';
type FilterState = Record<FilterKey, string>;

const SHIFT_LABEL: Record<string, string> = { manana: 'Manana', tarde: 'Tarde', noche: 'Noche' };
const STATUS_LABEL: Record<string, string> = { pendiente: 'Pendiente', confirmado: 'Confirmado' };

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
    const [localFilters, setLocalFilters] = useState<FilterState>({
        employee_id: filters.employee_id ? String(filters.employee_id) : '',
        reference_id: filters.reference_id ? String(filters.reference_id) : '',
        operation_id: filters.operation_id ? String(filters.operation_id) : '',
        date_start: filters.date_start ?? '',
        date_end: filters.date_end ?? '',
        shift: filters.shift ?? '',
        status: filters.status ?? '',
    });
    const [confirmDelete, setConfirmDelete] = useState<Production | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const apply = (next: FilterState = localFilters) => {
        const params: Record<string, string> = {};
        (Object.entries(next) as [FilterKey, string][]).forEach(([k, v]) => {
            if (v) params[k] = v;
        });
        router.get(route('productions.index'), params, { preserveState: true, replace: true });
    };

    const emptyFilters: FilterState = {
        employee_id: '',
        reference_id: '',
        operation_id: '',
        date_start: '',
        date_end: '',
        shift: '',
        status: '',
    };

    const reset = () => {
        setLocalFilters(emptyFilters);
        router.get(route('productions.index'), {}, { preserveState: true, replace: true });
    };

    /** Quita un filtro puntual desde su chip y recarga de inmediato. */
    const clearFilter = (key: FilterKey) => {
        const next = { ...localFilters, [key]: '' };
        setLocalFilters(next);
        apply(next);
    };

    // Chips de filtros activos (solo movil): evitan tener 6 selects siempre desplegados.
    const activeChips: { key: FilterKey; label: string }[] = [];
    if (localFilters.employee_id) {
        const e = employees.find((x) => String(x.id) === localFilters.employee_id);
        activeChips.push({
            key: 'employee_id',
            label: e ? (e.full_name ?? `${e.first_name} ${e.last_name}`) : 'Empleado',
        });
    }
    if (localFilters.reference_id) {
        const r = references.find((x) => String(x.id) === localFilters.reference_id);
        activeChips.push({ key: 'reference_id', label: r ? r.code : 'Referencia' });
    }
    if (localFilters.operation_id) {
        const o = operations.find((x) => String(x.id) === localFilters.operation_id);
        activeChips.push({ key: 'operation_id', label: o ? o.name : 'Operacion' });
    }
    if (localFilters.date_start) activeChips.push({ key: 'date_start', label: `Desde ${formatDate(localFilters.date_start)}` });
    if (localFilters.date_end) activeChips.push({ key: 'date_end', label: `Hasta ${formatDate(localFilters.date_end)}` });
    if (localFilters.shift) activeChips.push({ key: 'shift', label: SHIFT_LABEL[localFilters.shift] ?? localFilters.shift });
    if (localFilters.status) activeChips.push({ key: 'status', label: STATUS_LABEL[localFilters.status] ?? localFilters.status });

    /** Campos de filtro; se reutilizan en la tarjeta de escritorio y en la hoja movil. */
    const filterFields = (
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${workerMode ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
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
            <Input
                label="Desde"
                type="date"
                value={localFilters.date_start}
                onChange={(e) => setLocalFilters({ ...localFilters, date_start: e.target.value })}
            />
            <Input
                label="Hasta"
                type="date"
                value={localFilters.date_end}
                onChange={(e) => setLocalFilters({ ...localFilters, date_end: e.target.value })}
            />
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
    );

    // La barra inferior fija solo aplica cuando existe la accion "Registrar" como enlace.
    // En workerMode el formulario ya trae su propia barra fija y se solaparian.
    const showMobileCreateBar = !workerMode && !isConsolidatedView;

    return (
        <AppLayout title="Produccion">
            <Head title="Produccion" />
            <div className={`space-y-6 ${showMobileCreateBar ? 'pb-24 lg:pb-0' : ''}`}>
                <PageHeader
                    title={workerMode ? 'Mi produccion' : 'Produccion'}
                    description={
                        workerMode
                            ? 'Registra lo producido; tus registros recientes aparecen abajo.'
                            : 'Registro diario de produccion por empleado.'
                    }
                    action={
                        <div className="flex flex-wrap gap-2">
                            <Can permission="productions.report.view">
                                <Link href={route('productions.report')}>
                                    <Button variant="outline" icon={<ChartBarIcon className="h-4 w-4" />}>
                                        Reporte
                                    </Button>
                                </Link>
                            </Can>
                            <Can permission="productions.ranking.view">
                                <Link href={route('productions.ranking')}>
                                    <Button variant="outline" icon={<TrophyIcon className="h-4 w-4" />}>
                                        Ranking
                                    </Button>
                                </Link>
                            </Can>
                            {!workerMode && (
                                <Can permission="productions.index.create">
                                    {!isConsolidatedView ? (
                                        // En movil la accion primaria vive en la barra inferior fija.
                                        <Link href={route('productions.create')} className="hidden lg:block">
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

                {/* Filtros: colapsados en movil (boton + chips), tarjeta completa desde lg. */}
                <div className="lg:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(true)}
                            className="flex h-10 items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                        >
                            <AdjustmentsHorizontalIcon className="h-4 w-4" />
                            Filtros
                            {activeChips.length > 0 ? (
                                <span className="ml-0.5 rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                                    {activeChips.length}
                                </span>
                            ) : null}
                        </button>
                        {activeChips.map((chip) => (
                            <span
                                key={chip.key}
                                className="flex h-10 items-center gap-1 rounded-full bg-indigo-50 pl-3 pr-1 text-[13px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                            >
                                <span className="max-w-36 truncate">{chip.label}</span>
                                <button
                                    type="button"
                                    onClick={() => clearFilter(chip.key)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-800/50"
                                    aria-label={`Quitar filtro ${chip.label}`}
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                <Card className="hidden lg:block">
                    {!workerMode && <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Filtros</p>}
                    {workerMode && (
                        <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">Buscar en mis registros</p>
                    )}
                    {filterFields}
                    <div className="mt-3 flex justify-end gap-2">
                        <Button variant="ghost" onClick={reset}>
                            Limpiar
                        </Button>
                        <Button onClick={() => apply()}>Filtrar</Button>
                    </div>
                </Card>

                {workerMode && <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Mis registros</h2>}

                {/* Barra fina de resumen: cuantos registros y cuanto suman. */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-700">
                    <span className="text-[13px] text-slate-500 dark:text-slate-400">
                        Registros · <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(productions.total ?? productions.data.length)}</span>
                    </span>
                    <span className="text-[13px] text-slate-500 dark:text-slate-400">
                        Total <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(totals.total_value)}</span>
                    </span>
                </div>

                {/* Lista jerarquica en movil: una tarjeta por registro, sin repetir etiquetas. */}
                <div className="space-y-2 sm:hidden">
                    {productions.data.length === 0 ? (
                        <Card className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No hay registros.</Card>
                    ) : (
                        productions.data.map((p) => (
                            <div
                                key={p.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {p.employee?.first_name} {p.employee?.last_name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                                            {p.reference?.code} · {p.operation?.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                            {formatDate(p.date)} · <span className="capitalize">{p.shift}</span> ·{' '}
                                            {formatNumber(p.quantity)} und
                                        </p>
                                        {isConsolidatedView && p.company?.name ? (
                                            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                                {p.company.name}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {formatCurrency(p.total_value)}
                                        </span>
                                        <Badge variant={p.status === 'pendiente' ? 'warning' : 'success'}>
                                            {p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mt-1 flex justify-end gap-1">
                                    <Can permission="productions.index.edit">
                                        <Link href={route('productions.edit', p.id)}>
                                            <button
                                                type="button"
                                                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                                                aria-label="Editar registro"
                                            >
                                                <PencilSquareIcon className="h-5 w-5" />
                                            </button>
                                        </Link>
                                    </Can>
                                    <Can permission="productions.index.delete">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(p)}
                                            className="flex h-11 w-11 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                                            aria-label="Eliminar registro"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </Can>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden sm:block">
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
                                <tr>
                                    <td colSpan={isConsolidatedView ? 11 : 10} className="px-4 py-12 text-center text-sm text-slate-500">
                                        No hay registros.
                                    </td>
                                </tr>
                            ) : (
                                productions.data.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{formatDate(p.date)}</TableCell>
                                        {isConsolidatedView ? (
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                {p.company?.name ?? '—'}
                                            </TableCell>
                                        ) : null}
                                        <TableCell>
                                            {p.employee?.first_name} {p.employee?.last_name}
                                        </TableCell>
                                        <TableCell>
                                            {p.reference?.code} <span className="text-xs text-slate-500">{p.reference?.name}</span>
                                        </TableCell>
                                        <TableCell>{p.operation?.name}</TableCell>
                                        <TableCell align="right">{formatNumber(p.quantity)}</TableCell>
                                        <TableCell align="right">{formatCurrency(p.unit_price)}</TableCell>
                                        <TableCell align="right" className="font-medium">
                                            {formatCurrency(p.total_value)}
                                        </TableCell>
                                        <TableCell align="center" className="capitalize">
                                            {p.shift}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Badge variant={p.status === 'pendiente' ? 'warning' : 'success'}>
                                                {p.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex justify-end gap-1">
                                                <Can permission="productions.index.edit">
                                                    <Link href={route('productions.edit', p.id)}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<PencilSquareIcon className="h-4 w-4" />}
                                                        />
                                                    </Link>
                                                </Can>
                                                <Can permission="productions.index.delete">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                        onClick={() => setConfirmDelete(p)}
                                                    />
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
                                    <td
                                        colSpan={isConsolidatedView ? 5 : 4}
                                        className="px-4 py-3 text-right text-xs uppercase text-slate-500"
                                    >
                                        Totales
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                        {formatNumber(totals.total_quantity)}
                                    </td>
                                    <td />
                                    <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(totals.total_value)}
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </TableFoot>
                        )}
                    </Table>
                </div>

                <Pagination links={productions.links} from={productions.from} to={productions.to} total={productions.total} />
            </div>

            {/* Accion primaria al alcance del pulgar en movil. */}
            {showMobileCreateBar ? (
                <Can permission="productions.index.create">
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                        <Link href={route('productions.create')} className="block">
                            <Button icon={<PlusIcon className="h-5 w-5" />} fullWidth className="min-h-12 text-base">
                                Registrar produccion
                            </Button>
                        </Link>
                    </div>
                </Can>
            ) : null}

            <Modal
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                title="Filtros"
                size="lg"
                footer={
                    <div className="flex w-full gap-2">
                        <Button
                            variant="ghost"
                            fullWidth
                            className="min-h-11"
                            onClick={() => {
                                reset();
                                setFiltersOpen(false);
                            }}
                        >
                            Limpiar
                        </Button>
                        <Button
                            fullWidth
                            className="min-h-11"
                            onClick={() => {
                                apply();
                                setFiltersOpen(false);
                            }}
                        >
                            Aplicar
                        </Button>
                    </div>
                }
            >
                {filterFields}
            </Modal>

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
