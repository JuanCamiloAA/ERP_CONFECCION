import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowCounterClockwise,
    CaretDown,
    CaretLeft,
    CaretRight,
    DotsThreeVertical,
    MagnifyingGlass,
    PencilSimple,
    Plus,
    Prohibit,
    Trash,
    WarningCircle,
} from '@phosphor-icons/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { Fragment, useState, type ReactNode } from 'react';
import { payrollModeLabel } from '@/Components/Employees/PayrollModeField';
import { Avatar } from '@/Components/UI/Avatar';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { formatNumber } from '@/lib/utils';
import type { Employee, PaginatedResponse } from '@/types';
import '../../../css/module-ui.css';

interface Props {
    employees: PaginatedResponse<Employee>;
    filters: { search: string; status: string; mode?: string };
    metrics?: { active: number; with_access: number; missing_payment: number; inactive: number };
}

const STATUS_SEGMENTS = [
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'all', label: 'Todos' },
];

const MODE_OPTIONS = [
    { value: 'all', label: 'Toda modalidad' },
    { value: 'operations', label: 'Por operaciones' },
    { value: 'fixed_daily', label: 'Salario diario fijo' },
    { value: 'hourly_legal', label: 'Por horas — legal' },
];

/** "2025-03-14" -> "03/2025"; el dia no aporta en el listado. */
function hireMonth(date: string | null | undefined): string {
    if (!date) return '—';
    const [y, m] = String(date).slice(0, 10).split('-');

    return y && m ? `${m}/${y}` : '—';
}

/** Los tres campos de pago van juntos: con uno vacio no se puede dispersar. */
function hasPaymentData(employee: Employee): boolean {
    return Boolean(employee.bank_id && employee.bank_account_number && employee.bank_key);
}

/** Etiqueta de pagina de Laravel, sin entidades ni las palabras de navegacion. */
function pageLabel(label: string): string {
    return label
        .replace('&laquo;', '')
        .replace('&raquo;', '')
        .replace('Previous', '')
        .replace('Next', '')
        .replace('Anterior', '')
        .replace('Siguiente', '')
        .trim();
}

function roleName(employee: Employee): string | null {
    const roles = (employee.user as { roles?: { display_name: string }[] } | null | undefined)?.roles;

    return roles?.[0]?.display_name ?? null;
}

export default function EmployeesIndex({ employees, filters, metrics }: Props) {
    const isConsolidatedView = usePage<App.PageProps>().props.isConsolidatedView ?? false;
    const perms = usePermissions();
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [mode, setMode] = useState(filters.mode ?? 'all');
    const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);

    const updateFilters = (next: { search?: string; status?: string; mode?: string }) => {
        const params: Record<string, string> = {};
        const newSearch = next.search ?? search;
        const newStatus = next.status ?? status;
        const newMode = next.mode ?? mode;

        if (newSearch) params.search = newSearch;
        if (newStatus !== 'all') params.status = newStatus;
        if (newMode !== 'all') params.mode = newMode;

        router.get(route('employees.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('employees.destroy', confirmDelete.id), { onFinish: () => setConfirmDelete(null) });
    };

    const handleDeactivate = () => {
        if (!confirmDeactivate) return;
        router.post(route('employees.deactivate', confirmDeactivate.id), {}, {
            preserveScroll: true,
            onFinish: () => setConfirmDeactivate(null),
        });
    };

    const reactivate = (employee: Employee) => {
        router.post(route('employees.reactivate', employee.id), {}, { preserveScroll: true });
    };

    const total = employees.total ?? employees.data.length;
    const countLabel = `${formatNumber(total)} ${total === 1 ? 'empleado' : 'empleados'}`;

    const metricCards = [
        { key: 'active', label: 'Activos', value: metrics?.active ?? 0, accent: false },
        { key: 'with_access', label: 'Con acceso', value: metrics?.with_access ?? 0, accent: false },
        {
            key: 'missing_payment',
            label: 'Sin datos de pago',
            value: metrics?.missing_payment ?? 0,
            accent: (metrics?.missing_payment ?? 0) > 0,
        },
        { key: 'inactive', label: 'Inactivos', value: metrics?.inactive ?? 0, accent: false },
    ];

    /* ------------------------------------------------------------- fragmentos */

    const rowMenu = (employee: Employee) => {
        const items: { key: string; label: string; icon: ReactNode; onClick?: () => void; href?: string; danger?: boolean }[] = [];

        if (perms.can('employees.index.edit')) {
            items.push({
                key: 'edit',
                label: 'Editar',
                icon: <PencilSimple size={15} />,
                href: route('employees.edit', employee.id),
            });
        }

        // Inactivar y reactivar tienen permiso propio: se ofrecen solo si se tiene el suyo.
        if (employee.is_active) {
            if (perms.can('employees.index.deactivate')) {
                items.push({
                    key: 'deactivate',
                    label: 'Inactivar',
                    icon: <Prohibit size={15} />,
                    onClick: () => setConfirmDeactivate(employee),
                });
            }
        } else if (perms.can('employees.index.reactivate')) {
            items.push({
                key: 'reactivate',
                label: 'Reactivar',
                icon: <ArrowCounterClockwise size={15} />,
                onClick: () => reactivate(employee),
            });
        }

        if (perms.can('employees.index.delete')) {
            items.push({
                key: 'delete',
                label: 'Eliminar',
                icon: <Trash size={15} />,
                onClick: () => setConfirmDelete(employee),
                danger: true,
            });
        }

        if (items.length === 0) return null;

        return (
            <Menu as="div" className="relative shrink-0">
                <MenuButton
                    aria-label={`Acciones de ${employee.full_name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <DotsThreeVertical size={18} weight="bold" />
                </MenuButton>
                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <MenuItems
                        anchor="bottom end"
                        className="emp-card z-50 w-48 py-1 focus:outline-none"
                        style={{ backgroundColor: 'var(--emp-surface)' }}
                    >
                        {items.map((item) => {
                            const content = (
                                <span className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px]">
                                    {item.icon}
                                    {item.label}
                                </span>
                            );

                            return (
                                <MenuItem key={item.key}>
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            className="block w-full data-focus:bg-[color:var(--emp-accent-tint)]"
                                            style={{ color: 'var(--emp-text)' }}
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={item.onClick}
                                            className="block w-full data-focus:bg-[color:var(--emp-accent-tint)]"
                                            style={{ color: item.danger ? 'var(--emp-danger)' : 'var(--emp-text)' }}
                                        >
                                            {content}
                                        </button>
                                    )}
                                </MenuItem>
                            );
                        })}
                    </MenuItems>
                </Transition>
            </Menu>
        );
    };

    const paymentCell = (employee: Employee) =>
        hasPaymentData(employee) ? (
            <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                {employee.bank?.name ?? '—'}
                {employee.bank && !employee.bank.is_active ? (
                    <span className="ml-1.5 emp-pill emp-pill-warn">Inactivo</span>
                ) : null}
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 text-[13px]" style={{ color: 'var(--emp-accent-on)' }}>
                <WarningCircle size={14} style={{ color: 'var(--emp-accent-line)' }} />
                Falta banco
            </span>
        );

    /* ------------------------------------------------------------------ render */

    return (
        <AppLayout title="Empleados">
            <Head title="Empleados" />

            <div className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] sm:pb-8 lg:-m-8 lg:pb-8">
                {/* ------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                            Empleados
                        </h1>
                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            Personas del taller, su modalidad de pago y su acceso al sistema.
                        </p>
                    </div>

                    {!isConsolidatedView ? (
                        <Can permission="employees.index.create">
                            <Link href={route('employees.create')} className="emp-btn emp-btn-primary max-sm:hidden">
                                <Plus size={15} />
                                Nuevo empleado
                            </Link>
                        </Can>
                    ) : null}
                </div>

                {/* -------------------------------------------------- metricas */}
                <div className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
                    {metricCards.map((card) => (
                        <div key={card.key} className="emp-card min-w-[136px] shrink-0 p-[17px] sm:min-w-0">
                            <p className="emp-kicker">{card.label}</p>
                            <p
                                className="mt-1 text-[27px] leading-none"
                                style={{ color: card.accent ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                            >
                                {formatNumber(card.value)}
                            </p>
                        </div>
                    ))}
                </div>

                {/* --------------------------------------------------- filtros */}
                <div
                    className="sticky top-16 z-10 -mx-4 mt-4 bg-[color:var(--emp-bg)] px-4 py-3 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0"
                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                >
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <div className="relative sm:max-w-[420px] sm:flex-1">
                            <MagnifyingGlass
                                size={15}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--emp-subtle)' }}
                            />
                            <input
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    updateFilters({ search: e.target.value });
                                }}
                                placeholder="Buscar por nombre o documento..."
                                aria-label="Buscar empleados"
                                className="emp-field pl-8"
                            />
                        </div>

                        <div className="emp-seg sm:w-[240px]">
                            {STATUS_SEGMENTS.map((seg) => (
                                <button
                                    key={seg.value}
                                    type="button"
                                    onClick={() => {
                                        setStatus(seg.value);
                                        updateFilters({ status: seg.value });
                                    }}
                                    className={`emp-seg-item ${status === seg.value ? 'emp-seg-on' : ''}`}
                                >
                                    {seg.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative max-sm:hidden">
                            <select
                                value={mode}
                                onChange={(e) => {
                                    setMode(e.target.value);
                                    updateFilters({ mode: e.target.value });
                                }}
                                aria-label="Filtrar por modalidad"
                                className="emp-field w-[190px]"
                            >
                                {MODE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <CaretDown
                                size={13}
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--emp-subtle)' }}
                            />
                        </div>

                        <span className="ml-auto shrink-0 text-[12px] max-sm:hidden" style={{ color: 'var(--emp-subtle)' }}>
                            {countLabel}
                        </span>
                    </div>
                </div>

                {/* ------------------------------------------- movil: tarjetas */}
                <div className="mt-3 flex flex-col gap-2 lg:hidden">
                    {employees.data.length === 0 ? (
                        <p className="emp-card p-6 text-center text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            No se encontraron empleados.
                        </p>
                    ) : (
                        employees.data.map((employee) => (
                            <div
                                key={employee.id}
                                className={`emp-card flex items-start gap-3 p-3 ${employee.is_active ? '' : 'emp-row-off'}`}
                            >
                                <Avatar src={employee.photo} name={employee.full_name} size="md" className="shrink-0" zoomable />

                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={route('employees.show', employee.id)}
                                        className="block truncate text-[14px]"
                                        style={{ color: 'var(--emp-text)' }}
                                    >
                                        {employee.full_name}
                                    </Link>
                                    <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                        {employee.document_type} {employee.document_number} · ingresó{' '}
                                        {hireMonth(employee.hire_date)}
                                    </p>
                                    {isConsolidatedView && employee.company?.name ? (
                                        <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {employee.company.name}
                                        </p>
                                    ) : null}

                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                        <span className="emp-pill">{payrollModeLabel(employee.payroll_mode)}</span>
                                        {hasPaymentData(employee) ? (
                                            <span className="emp-pill">{employee.bank?.name}</span>
                                        ) : (
                                            <span className="emp-pill emp-pill-accent">Falta banco</span>
                                        )}
                                        <span className="emp-pill">{roleName(employee) ?? (employee.user_id ? 'Con acceso' : 'Sin acceso')}</span>
                                        {!employee.is_active ? <span className="emp-pill emp-pill-warn">Inactivo</span> : null}
                                    </div>
                                </div>

                                {rowMenu(employee)}
                            </div>
                        ))
                    )}
                </div>

                {/* ---------------------------------------- escritorio: tabla */}
                <div className="mt-4 hidden lg:block">
                    <table className="w-full text-left">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--emp-border)' }}>
                                {['Empleado', isConsolidatedView ? 'Empresa' : null, 'Documento', 'Modalidad', 'Pago', 'Acceso']
                                    .filter(Boolean)
                                    .map((headerLabel) => (
                                        <th
                                            key={headerLabel as string}
                                            scope="col"
                                            className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.09em]"
                                            style={{ color: 'var(--emp-subtle)' }}
                                        >
                                            {headerLabel}
                                        </th>
                                    ))}
                                <th scope="col" className="px-3 pb-2 text-right">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isConsolidatedView ? 7 : 6}
                                        className="px-3 py-12 text-center text-[13px]"
                                        style={{ color: 'var(--emp-muted)' }}
                                    >
                                        No se encontraron empleados.
                                    </td>
                                </tr>
                            ) : (
                                employees.data.map((employee) => (
                                    <tr
                                        key={employee.id}
                                        className={`emp-row-sep ${employee.is_active ? '' : 'emp-row-off'}`}
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar
                                                    src={employee.photo}
                                                    name={employee.full_name}
                                                    size="sm"
                                                    className="h-[34px] w-[34px] shrink-0"
                                                    zoomable
                                                />
                                                <div className="min-w-0">
                                                    <Link
                                                        href={route('employees.show', employee.id)}
                                                        className="block truncate text-[14px] hover:underline"
                                                        style={{ color: 'var(--emp-text)' }}
                                                    >
                                                        {employee.full_name}
                                                    </Link>
                                                    {employee.email ? (
                                                        <p
                                                            className="truncate text-[12px]"
                                                            style={{ color: 'var(--emp-muted)' }}
                                                        >
                                                            {employee.email}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>

                                        {isConsolidatedView ? (
                                            <td className="px-3 py-2.5 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                                {employee.company?.name ?? '—'}
                                            </td>
                                        ) : null}

                                        <td className="px-3 py-2.5 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                            <span className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                {employee.document_type}
                                            </span>{' '}
                                            {employee.document_number}
                                        </td>

                                        <td className="px-3 py-2.5">
                                            <span className="emp-pill">{payrollModeLabel(employee.payroll_mode)}</span>
                                        </td>

                                        <td className="px-3 py-2.5">{paymentCell(employee)}</td>

                                        <td className="px-3 py-2.5 text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                            {employee.user_id ? (
                                                roleName(employee) ?? 'Con acceso'
                                            ) : (
                                                <span style={{ color: 'var(--emp-subtle)' }}>Sin acceso</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Editar y reactivar son dos permisos distintos: cada boton pide el suyo. */}
                                                {employee.is_active ? (
                                                    <Can permission="employees.index.edit">
                                                        <Link
                                                            href={route('employees.edit', employee.id)}
                                                            aria-label={`Editar a ${employee.full_name}`}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                                                            style={{ color: 'var(--emp-muted)' }}
                                                        >
                                                            <PencilSimple size={15} />
                                                        </Link>
                                                    </Can>
                                                ) : (
                                                    <Can permission="employees.index.reactivate">
                                                        <button
                                                            type="button"
                                                            onClick={() => reactivate(employee)}
                                                            className="emp-btn emp-btn-sm"
                                                        >
                                                            <ArrowCounterClockwise size={14} />
                                                            Reactivar
                                                        </button>
                                                    </Can>
                                                )}
                                                {rowMenu(employee)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ----------------------------------------------- paginacion */}
                {employees.links.length > 3 || total > employees.data.length ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Mostrando {formatNumber(employees.from ?? 0)}–{formatNumber(employees.to ?? 0)} de{' '}
                            {formatNumber(total)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {employees.links.map((link, index) => {
                                const isPrev = index === 0;
                                const isNext = index === employees.links.length - 1;

                                return (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        aria-label={isPrev ? 'Página anterior' : isNext ? 'Página siguiente' : undefined}
                                        aria-current={link.active ? 'page' : undefined}
                                        className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-lg px-2 text-[12px] ${
                                            link.active ? 'emp-seg-on' : ''
                                        } ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        style={{
                                            border: '1px solid var(--emp-border)',
                                            color: link.active ? 'var(--emp-accent-on)' : 'var(--emp-muted)',
                                        }}
                                    >
                                        {isPrev ? (
                                            <CaretLeft size={13} />
                                        ) : isNext ? (
                                            <CaretRight size={13} />
                                        ) : (
                                            pageLabel(link.label)
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Movil: crear siempre a mano. */}
            {!isConsolidatedView ? (
                <Can permission="employees.index.create">
                    <div
                        className="emp-form fixed inset-x-0 bottom-0 z-30 px-4 pb-5 pt-3 sm:hidden"
                        style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                    >
                        <Link href={route('employees.create')} className="emp-btn emp-btn-primary w-full">
                            <Plus size={17} />
                            Nuevo empleado
                        </Link>
                    </div>
                </Can>
            ) : null}

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar empleado"
                message={`¿Seguro que deseas eliminar a ${confirmDelete?.full_name}? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
            />

            <ConfirmDialog
                open={!!confirmDeactivate}
                onClose={() => setConfirmDeactivate(null)}
                onConfirm={handleDeactivate}
                title="Inactivar empleado"
                message={`¿Inactivar a ${confirmDeactivate?.full_name}? Dejará de figurar como activo y, si tiene cuenta en el sistema, no podrá iniciar sesión. No borra el registro del empleado ni el historial.`}
                confirmText="Inactivar"
                variant="primary"
            />
        </AppLayout>
    );
}
