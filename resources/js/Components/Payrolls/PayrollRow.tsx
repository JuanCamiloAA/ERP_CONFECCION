import { Link, usePage } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { ArrowUpRight, DotsThreeVertical, FileText, Printer, Trash } from '@phosphor-icons/react';
import { Fragment } from 'react';
import { PayrollActionIcon, PayrollFlowBar, PayrollStatePill } from '@/Components/Payrolls/PayrollFlowBar';
import { usePermissions } from '@/contexts/PermissionsContext';
import { isClosed, nextAction, shortPeriod, stepLabel, type PayrollStatus } from '@/lib/payrolls';
import { formatCurrency, formatNumber, formatRelativeDate } from '@/lib/utils';
import type { Payroll } from '@/types';

export type PayrollRowData = Payroll & {
    payroll_employees_count?: number;
    creator?: { id: number; name: string; last_name: string | null } | null;
};

/** Reticula de la tabla, compartida por la cabecera y las filas. */
export const PAYROLL_GRID = '150px minmax(0,1fr) 90px 168px 132px 104px 138px';

/** Verbo del ultimo movimiento; `updated_at` cambia con cada paso del flujo. */
const STATE_VERB: Record<PayrollStatus, string> = {
    borrador: 'creada',
    calculado: 'calculada',
    aprobado: 'aprobada',
    pagado: 'pagada',
};

export function activityLine(payroll: PayrollRowData): string {
    const when = formatRelativeDate(payroll.updated_at ?? payroll.created_at);

    return `${payroll.type} · ${STATE_VERB[payroll.status] ?? 'actualizada'} ${when}`;
}

export function creatorName(payroll: PayrollRowData): string | null {
    if (!payroll.creator) return null;

    return `${payroll.creator.name ?? ''} ${payroll.creator.last_name ?? ''}`.trim() || null;
}

/**
 * Boton de la accion siguiente.
 *
 * Solo navega al detalle: calcular, aprobar y pagar son POST con confirmacion y viven en
 * `Payrolls/Show`. Llevar aqui esas acciones obligaria a repetir los avisos —«se aplicaran
 * los ajustes capturados», «despues de aprobada no se puede recalcular»— en dos sitios.
 */
export function PayrollNextActionButton({
    payroll,
    className = 'emp-btn emp-btn-sm emp-btn-primary',
    iconSize = 14,
}: {
    payroll: PayrollRowData;
    className?: string;
    iconSize?: number;
}) {
    const perms = usePermissions();
    const action = nextAction(payroll.status);

    if (!perms.can(action.permission) || !perms.can('payrolls.show.view')) {
        return null;
    }

    if (action.action === 'export') {
        return (
            <a
                href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                target="_blank"
                rel="noreferrer"
                className={className}
                aria-label={`Comprobantes de ${payroll.name}`}
            >
                <PayrollActionIcon name={action.icon} size={iconSize} />
                {action.label}
            </a>
        );
    }

    return (
        <Link href={route('payrolls.show', payroll.id)} className={className} aria-label={`${action.label}: ${payroll.name}`}>
            <PayrollActionIcon name={action.icon} size={iconSize} />
            {action.label}
        </Link>
    );
}

/** Menu de acciones de una nomina. Lo comparten la fila y la tarjeta de movil. */
export function PayrollActionsMenu({
    payroll,
    onDelete,
}: {
    payroll: PayrollRowData;
    onDelete: (payroll: PayrollRowData) => void;
}) {
    const perms = usePermissions();
    const page = usePage<App.PageProps>();
    const isSuperAdmin = Boolean(page.props.auth.user?.is_super_admin);
    const item =
        'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';
    const closed = isClosed(payroll.status);
    const canDelete = perms.can('payrolls.index.delete') && (! closed || isSuperAdmin);

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton
                aria-label={`Acciones de la nómina ${payroll.name}`}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                style={{ color: 'var(--emp-muted)' }}
            >
                <DotsThreeVertical size={17} weight="bold" />
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
                    className="emp-card z-50 w-60 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--emp-surface)' }}
                >
                    {perms.can('payrolls.show.view') ? (
                        <MenuItem>
                            <Link href={route('payrolls.show', payroll.id)} className={item} style={{ color: 'var(--emp-text)' }}>
                                <ArrowUpRight size={15} />
                                Ver detalle
                            </Link>
                        </MenuItem>
                    ) : null}

                    <MenuItem>
                        <a
                            href={route('payrolls.export', payroll.id)}
                            target="_blank"
                            rel="noreferrer"
                            className={item}
                            style={{ color: 'var(--emp-text)' }}
                        >
                            <Printer size={15} />
                            Imprimir general
                        </a>
                    </MenuItem>

                    <MenuItem>
                        <a
                            href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                            target="_blank"
                            rel="noreferrer"
                            className={item}
                            style={{ color: 'var(--emp-text)' }}
                        >
                            <FileText size={15} />
                            Imprimir detallado
                        </a>
                    </MenuItem>

                    {canDelete ? (
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => onDelete(payroll)}
                                className={item}
                                style={{ color: 'var(--emp-danger)' }}
                            >
                                <Trash size={15} />
                                {closed ? 'Eliminar y revertir' : 'Eliminar'}
                            </button>
                        </MenuItem>
                    ) : closed ? (
                        <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            Una nómina cerrada solo la elimina el super usuario.
                        </p>
                    ) : null}
                </MenuItems>
            </Transition>
        </Menu>
    );
}

interface Props {
    payroll: PayrollRowData;
    onDelete: (payroll: PayrollRowData) => void;
    /** La nomina abierta mas reciente se marca con el filo de acento a la izquierda. */
    highlighted?: boolean;
    showCompany?: boolean;
}

export function PayrollRow({ payroll, onDelete, highlighted = false, showCompany = false }: Props) {
    const perms = usePermissions();
    const net = Number(payroll.total_amount ?? 0);
    const employees = payroll.payroll_employees_count;

    return (
        <div
            className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5"
            style={{
                gridTemplateColumns: PAYROLL_GRID,
                ...(highlighted
                    ? { backgroundColor: 'var(--emp-row-hover)', boxShadow: 'inset 2px 0 0 var(--emp-accent-line)' }
                    : {}),
            }}
        >
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {shortPeriod(payroll.period_start, payroll.period_end)}
            </span>

            <div className="min-w-0">
                {perms.can('payrolls.show.view') ? (
                    <Link
                        href={route('payrolls.show', payroll.id)}
                        className="block truncate text-[14px] hover:underline"
                        style={{ color: 'var(--emp-text)' }}
                    >
                        {payroll.name}
                    </Link>
                ) : (
                    <p className="truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                        {payroll.name}
                    </p>
                )}
                <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                    {activityLine(payroll)}
                </p>
                {showCompany && payroll.company?.name ? (
                    <p className="truncate text-[11px]" style={{ color: 'var(--emp-faint)' }}>
                        {payroll.company.name}
                    </p>
                ) : null}
            </div>

            <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {payroll.status === 'borrador' || employees == null || employees === 0
                    ? '—'
                    : formatNumber(employees)}
            </span>

            <div className="min-w-0">
                <PayrollFlowBar status={payroll.status} thickness={3} />
                <p
                    className="mt-1 truncate text-[11px]"
                    style={{ color: payroll.status === 'pagado' ? 'var(--emp-ok)' : 'var(--emp-accent-on)' }}
                >
                    {stepLabel(payroll.status)}
                </p>
            </div>

            <span
                className="text-right text-[14px] tabular-nums"
                style={{ color: net > 0 ? 'var(--emp-text)' : 'var(--emp-faint)' }}
            >
                {formatCurrency(net)}
            </span>

            <span>
                <PayrollStatePill status={payroll.status} />
            </span>

            <div className="flex items-center justify-end gap-1">
                <PayrollNextActionButton payroll={payroll} />
                <PayrollActionsMenu payroll={payroll} onDelete={onDelete} />
            </div>
        </div>
    );
}

export default PayrollRow;
