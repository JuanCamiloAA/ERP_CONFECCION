import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BanknotesIcon,
    CalculatorIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    EyeIcon,
    PlusIcon,
    PrinterIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { RowActionsMenu, type RowAction } from '@/Components/UI/RowActionsMenu';
import { Select } from '@/Components/UI/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
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

/** Orden del flujo; el indice marca cuantas barras de avance van llenas. */
const FLOW: Payroll['status'][] = ['borrador', 'calculado', 'aprobado', 'pagado'];

const STATUS_OPTIONS = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'borrador', label: 'Borrador' },
    { value: 'calculado', label: 'Calculado' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'pagado', label: 'Pagado' },
];

/**
 * Una nomina aprobada o pagada esta cerrada: eliminarla deshace el cierre (produccion y
 * anticipos vuelven atras) y solo lo puede hacer el super usuario, como salida cuando la
 * empresa cierra el periodo por error.
 */
const isClosed = (p: Payroll): boolean => p.status === 'pagado' || p.status === 'aprobado';

export default function PayrollsIndex({ payrolls, filters }: Props) {
    const page = usePage<App.PageProps>();
    const isConsolidatedView = page.props.isConsolidatedView ?? false;
    const isSuperAdmin = Boolean(page.props.auth.user?.is_super_admin);
    const perms = usePermissions();
    const [confirmDelete, setConfirmDelete] = useState<Payroll | null>(null);
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [year, setYear] = useState(filters.year ?? new Date().getFullYear());
    const [filtersOpen, setFiltersOpen] = useState(false);

    const apply = (nextStatus = status, nextYear = year) => {
        const params: Record<string, string | number> = { year: nextYear };
        if (nextStatus !== 'all') params.status = nextStatus;
        router.get(route('payrolls.index'), params, { preserveState: true, replace: true });
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Todos los estados';

    /**
     * Accion principal segun el estado. Solo navega al detalle: calcular/aprobar/pagar
     * son acciones POST que viven en Show.tsx con sus confirmaciones y permisos.
     */
    const stateAction = (p: Payroll) => {
        const to = route('payrolls.show', p.id);
        switch (p.status) {
            case 'borrador':
                return { label: 'Calcular', icon: <CalculatorIcon className="h-4 w-4" />, href: to, variant: 'primary' as const };
            case 'calculado':
                return { label: 'Aprobar', icon: <CheckCircleIcon className="h-4 w-4" />, href: to, variant: 'success' as const };
            case 'aprobado':
                return { label: 'Marcar pagada', icon: <BanknotesIcon className="h-4 w-4" />, href: to, variant: 'success' as const };
            default:
                return {
                    label: 'Comprobantes',
                    icon: <PrinterIcon className="h-4 w-4" />,
                    href: route('payrolls.export', p.id),
                    variant: 'outline' as const,
                };
        }
    };

    const rowActions = (p: Payroll): RowAction[] => {
        const actions: RowAction[] = [];
        if (perms.can('payrolls.show.view')) {
            actions.push({ key: 'view', label: 'Ver detalle', icon: <EyeIcon className="h-4 w-4" />, href: route('payrolls.show', p.id) });
        }
        if (perms.can('payrolls.index.delete') && (! isClosed(p) || isSuperAdmin)) {
            actions.push({
                key: 'delete',
                label: isClosed(p) ? 'Eliminar y revertir' : 'Eliminar',
                icon: <TrashIcon className="h-4 w-4" />,
                danger: true,
                onClick: () => setConfirmDelete(p),
            });
        }
        return actions;
    };

    return (
        <AppLayout title="Nominas">
            <Head title="Nominas" />
            <div className="space-y-6 pb-24 lg:pb-0">
                <PageHeader
                    title="Nominas"
                    description="Periodos de nomina de la empresa."
                    action={
                        !isConsolidatedView ? (
                            <Can permission="payrolls.index.create">
                                <Link href={route('payrolls.create')} className="hidden lg:block">
                                    <Button icon={<PlusIcon className="h-4 w-4" />}>Nueva nomina</Button>
                                </Link>
                            </Can>
                        ) : undefined
                    }
                />

                {/* Filtros: chips en movil, los selects de siempre desde lg. */}
                <div className="flex flex-wrap gap-2 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setFiltersOpen(true)}
                        className="flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                        {year}
                        <ChevronDownIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltersOpen(true)}
                        className="flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                        {statusLabel}
                        <ChevronDownIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="hidden flex-wrap gap-3 lg:flex">
                    <Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        options={STATUS_OPTIONS}
                        className="sm:max-w-xs"
                    />
                    <Select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        className="sm:max-w-[140px]"
                    />
                    <Button onClick={() => apply()}>Filtrar</Button>
                </div>

                {/* Movil: una tarjeta por periodo, con el flujo de estados y su accion. */}
                <div className="space-y-3 lg:hidden">
                    {payrolls.data.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            No hay nominas.
                        </div>
                    ) : (
                        payrolls.data.map((p) => {
                            const step = FLOW.indexOf(p.status);
                            const action = stateAction(p);

                            return (
                                <div
                                    key={p.id}
                                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <Can
                                                permission="payrolls.show.view"
                                                fallback={
                                                    <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                                                        {p.name}
                                                    </p>
                                                }
                                            >
                                                <Link
                                                    href={route('payrolls.show', p.id)}
                                                    className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                    {p.name}
                                                </Link>
                                            </Can>
                                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(p.period_start)} – {formatDate(p.period_end)} ·{' '}
                                                <span className="capitalize">{p.type}</span>
                                                {p.payroll_employees_count != null
                                                    ? ` · ${formatNumber(p.payroll_employees_count)} empleados`
                                                    : ''}
                                            </p>
                                            {isConsolidatedView && p.company?.name ? (
                                                <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                                    {p.company.name}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Badge variant={statusVariant[p.status] ?? 'neutral'}>{p.status}</Badge>
                                            <RowActionsMenu actions={rowActions(p)} />
                                        </div>
                                    </div>

                                    {/* Flujo borrador -> calculado -> aprobado -> pagado */}
                                    <div className="mt-3 flex gap-1.5" aria-hidden="true">
                                        {FLOW.map((s, i) => (
                                            <span
                                                key={s}
                                                className={`h-1 flex-1 rounded-full ${
                                                    i <= step
                                                        ? p.status === 'pagado'
                                                            ? 'bg-emerald-500'
                                                            : 'bg-indigo-500'
                                                        : 'bg-slate-200 dark:bg-slate-700'
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                Total
                                            </p>
                                            <p className="text-[22px] font-bold leading-tight tabular-nums text-slate-900 dark:text-slate-100">
                                                {formatCurrency(p.total_amount)}
                                            </p>
                                        </div>
                                        <Can permission="payrolls.show.view">
                                            <Link href={action.href}>
                                                <Button variant={action.variant} icon={action.icon} className="min-h-11">
                                                    {action.label}
                                                </Button>
                                            </Link>
                                        </Can>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="hidden lg:block">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Nomina</TableHeader>
                                {isConsolidatedView ? <TableHeader>Empresa</TableHeader> : null}
                                <TableHeader>Periodo</TableHeader>
                                <TableHeader align="center">Tipo</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Total</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {payrolls.data.length === 0 ? (
                                <tr>
                                    <td colSpan={isConsolidatedView ? 7 : 6} className="px-4 py-12 text-center text-sm text-slate-500">
                                        No hay nominas.
                                    </td>
                                </tr>
                            ) : (
                                payrolls.data.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <Link
                                                href={route('payrolls.show', p.id)}
                                                className="font-medium text-indigo-600 underline-offset-2 hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                                            >
                                                {p.name}
                                            </Link>
                                        </TableCell>
                                        {isConsolidatedView ? (
                                            <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                {p.company?.name ?? '—'}
                                            </TableCell>
                                        ) : null}
                                        <TableCell>
                                            {formatDate(p.period_start)} - {formatDate(p.period_end)}
                                        </TableCell>
                                        <TableCell align="center" className="capitalize">
                                            {p.type}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Badge variant={statusVariant[p.status] ?? 'neutral'}>{p.status}</Badge>
                                        </TableCell>
                                        <TableCell align="right" className="font-semibold">
                                            {formatCurrency(p.total_amount)}
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex justify-end gap-1">
                                                <Can permission="payrolls.show.view">
                                                    <Link href={route('payrolls.show', p.id)}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title="Ver detalle"
                                                            aria-label={`Ver detalle de ${p.name}`}
                                                            icon={<EyeIcon className="h-4 w-4" />}
                                                        />
                                                    </Link>
                                                </Can>
                                                <Can permission="payrolls.index.delete">
                                                    {! isClosed(p) || isSuperAdmin ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title={isClosed(p) ? 'Eliminar y revertir el cierre' : 'Eliminar'}
                                                            aria-label={`Eliminar ${p.name}`}
                                                            icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                            onClick={() => setConfirmDelete(p)}
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
                </div>

                <Pagination links={payrolls.links} from={payrolls.from} to={payrolls.to} total={payrolls.total} />
            </div>

            {!isConsolidatedView ? (
                <Can permission="payrolls.index.create">
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-5 pt-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                        <Link href={route('payrolls.create')} className="block">
                            <Button icon={<PlusIcon className="h-5 w-5" />} fullWidth className="min-h-12 text-base">
                                Nueva nomina
                            </Button>
                        </Link>
                    </div>
                </Can>
            ) : null}

            <Modal
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                title="Filtrar nominas"
                footer={
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
                }
            >
                <div className="space-y-4">
                    <Select
                        label="Ano"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                    />
                    <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} />
                </div>
            </Modal>

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('payrolls.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
                }}
                title={confirmDelete && isClosed(confirmDelete) ? 'Eliminar y revertir el cierre' : 'Eliminar nomina'}
                variant={confirmDelete && isClosed(confirmDelete) ? 'danger' : undefined}
                confirmText={confirmDelete && isClosed(confirmDelete) ? 'Eliminar y revertir' : undefined}
                message={
                    confirmDelete && isClosed(confirmDelete)
                        ? `La nomina "${confirmDelete.name}" esta ${confirmDelete.status}. Al eliminarla se deshace el cierre: la produccion liquidada vuelve al estado que tenia y los anticipos recuperan su saldo, de modo que puedas generar el periodo de nuevo desde cero. Queda registro de quien lo hizo.`
                        : `Eliminar la nomina "${confirmDelete?.name}"?`
                }
            />
        </AppLayout>
    );
}
