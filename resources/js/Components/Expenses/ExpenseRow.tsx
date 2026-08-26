import { Link } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { ArrowUpRight, DotsThreeVertical, Eye, PencilSimple, Trash } from '@phosphor-icons/react';
import { Fragment } from 'react';
import { ReceiptChip } from '@/Components/Expenses/ReceiptChip';
import { Can } from '@/Components/UI/Can';
import { receiptKind, type ExpenseRowLike } from '@/lib/expenses';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

export type ExpenseRowData = ExpenseRowLike;

/** Reticula de la tabla, compartida por la cabecera y las filas. */
export const EXPENSE_GRID = '92px 200px 1fr 132px 118px 150px 76px';

interface MenuProps {
    expense: ExpenseRowData;
    onDelete: (expense: ExpenseRowData) => void;
    /** En vista consolidada no hay escritura; se dice en la cabecera y aqui se retira. */
    readOnly?: boolean;
}

/**
 * Menu de acciones de un gasto. Lo comparten la fila y la tarjeta de movil.
 *
 * «Ver comprobante» se queda visible aunque no haya archivo: deshabilitado y con el
 * motivo. Esconderlo dejaria al usuario sin saber que ese gasto tiene un pendiente.
 */
export function ExpenseActionsMenu({ expense, onDelete, readOnly = false }: MenuProps) {
    const item = 'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';
    const hasReceipt = receiptKind(expense) !== 'missing';

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton
                aria-label={`Acciones del gasto ${expense.description}`}
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
                    className="emp-card z-50 w-56 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--emp-surface)' }}
                >
                    <MenuItem>
                        <Link href={route('expenses.show', expense.id)} className={item} style={{ color: 'var(--emp-text)' }}>
                            <ArrowUpRight size={15} />
                            Ver detalle
                        </Link>
                    </MenuItem>

                    {hasReceipt ? (
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => window.open(expense.receipt_url ?? '', '_blank')}
                                className={item}
                                style={{ color: 'var(--emp-text)' }}
                            >
                                <Eye size={15} />
                                Ver comprobante
                            </button>
                        </MenuItem>
                    ) : (
                        <p className="flex items-center gap-2.5 px-3 py-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            <Eye size={15} />
                            Sin comprobante cargado
                        </p>
                    )}

                    {!readOnly ? (
                        <>
                            <Can permission="expenses.index.edit">
                                <MenuItem>
                                    <Link
                                        href={route('expenses.edit', expense.id)}
                                        className={item}
                                        style={{ color: 'var(--emp-text)' }}
                                    >
                                        <PencilSimple size={15} />
                                        Editar
                                    </Link>
                                </MenuItem>
                            </Can>

                            <Can permission="expenses.index.delete">
                                <MenuItem>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(expense)}
                                        className={item}
                                        style={{ color: 'var(--emp-danger)' }}
                                    >
                                        <Trash size={15} />
                                        Archivar
                                    </button>
                                </MenuItem>
                            </Can>
                        </>
                    ) : null}
                </MenuItems>
            </Transition>
        </Menu>
    );
}

interface Props {
    expense: ExpenseRowData;
    onDelete: (expense: ExpenseRowData) => void;
    /** En consolidada la empresa va como segunda linea de la celda de categoria. */
    showCompany?: boolean;
    readOnly?: boolean;
}

export function ExpenseRow({ expense, onDelete, showCompany = false, readOnly = false }: Props) {
    return (
        <div
            className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5"
            style={{ gridTemplateColumns: EXPENSE_GRID }}
        >
            {/* La fecha de registro pasa al title: libera 150px y sigue disponible. */}
            <span
                className="text-[13px] tabular-nums"
                style={{ color: 'var(--emp-muted)' }}
                title={expense.created_at ? `Registrado el ${formatDateTime(expense.created_at)}` : undefined}
            >
                {formatDate(expense.expense_date)}
            </span>

            <div className="min-w-0">
                <span className="emp-pill max-w-full truncate">{expense.category?.name ?? 'Sin categoría'}</span>
                {showCompany && expense.company ? (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {expense.company.name}
                    </p>
                ) : null}
            </div>

            <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Link
                        href={route('expenses.show', expense.id)}
                        className="truncate text-[14px] hover:underline"
                        style={{ color: expense.needs_detail ? 'var(--emp-subtle)' : 'var(--emp-text)' }}
                    >
                        {expense.description}
                    </Link>
                    {expense.needs_detail ? <span className="emp-pill emp-pill-accent shrink-0">Completar</span> : null}
                </div>
                {expense.notes ? (
                    <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                        {expense.notes}
                    </p>
                ) : null}
            </div>

            <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatCurrency(expense.amount)}
            </span>

            <span>
                <ReceiptChip expense={expense} />
            </span>

            <span className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                {expense.creator?.full_name ?? '—'}
            </span>

            <div className="flex items-center justify-end gap-0.5">
                <Link
                    href={route('expenses.show', expense.id)}
                    aria-label={`Ver el gasto ${expense.description}`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <ArrowUpRight size={15} />
                </Link>
                <ExpenseActionsMenu expense={expense} onDelete={onDelete} readOnly={readOnly} />
            </div>
        </div>
    );
}

export default ExpenseRow;
