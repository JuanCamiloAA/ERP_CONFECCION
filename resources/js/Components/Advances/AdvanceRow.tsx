import { Link } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { ArrowUpRight, DotsThreeVertical, Printer, Trash } from '@phosphor-icons/react';
import { Fragment } from 'react';
import { AdvanceBalanceCell } from '@/Components/Advances/AdvanceBalanceCell';
import { AdvanceStatePill } from '@/Components/Advances/AdvanceStatePill';
import { Can } from '@/Components/UI/Can';
import { canDeleteAdvance } from '@/lib/advances';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Advance, Employee } from '@/types';

export type AdvanceRowData = Advance & { employee?: Employee };

/** Reticula de la tabla, compartida por la cabecera y las filas. */
export const ADVANCE_GRID = '96px 1fr 190px 130px 210px 120px 76px';

export function employeeName(advance: AdvanceRowData): string {
    const name = `${advance.employee?.first_name ?? ''} ${advance.employee?.last_name ?? ''}`.trim();

    return name || 'Empleado';
}

/**
 * Menu de acciones de un anticipo. Lo comparten la fila y la tarjeta de movil.
 *
 * «Eliminar» solo aparece cuando de verdad se puede: el servidor rechaza el borrado en
 * cuanto hay un descuento aplicado, y ofrecer un boton que va a fallar es peor que no
 * ofrecerlo.
 */
export function AdvanceActionsMenu({
    advance,
    onDelete,
}: {
    advance: AdvanceRowData;
    onDelete: (advance: AdvanceRowData) => void;
}) {
    const item = 'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';
    const deletable = canDeleteAdvance(advance);

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton
                aria-label={`Acciones del anticipo de ${employeeName(advance)}`}
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
                        <Link href={route('advances.show', advance.id)} className={item} style={{ color: 'var(--emp-text)' }}>
                            <ArrowUpRight size={15} />
                            Ver detalle
                        </Link>
                    </MenuItem>

                    <Can permission="advances.index.view">
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => window.open(route('advances.receipt', advance.id), '_blank')}
                                className={item}
                                style={{ color: 'var(--emp-text)' }}
                            >
                                <Printer size={15} />
                                Comprobante
                            </button>
                        </MenuItem>
                    </Can>

                    {deletable ? (
                        <Can permission="advances.index.delete">
                            <MenuItem>
                                <button
                                    type="button"
                                    onClick={() => onDelete(advance)}
                                    className={item}
                                    style={{ color: 'var(--emp-danger)' }}
                                >
                                    <Trash size={15} />
                                    Eliminar
                                </button>
                            </MenuItem>
                        </Can>
                    ) : (
                        <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            No se puede eliminar: ya tiene descuentos aplicados.
                        </p>
                    )}
                </MenuItems>
            </Transition>
        </Menu>
    );
}

interface Props {
    advance: AdvanceRowData;
    onDelete: (advance: AdvanceRowData) => void;
}

export function AdvanceRow({ advance, onDelete }: Props) {
    return (
        <div
            className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5"
            style={{ gridTemplateColumns: ADVANCE_GRID }}
        >
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {formatDate(advance.date)}
            </span>

            <div className="min-w-0">
                <Link
                    href={route('advances.show', advance.id)}
                    className="block truncate text-[14px] capitalize hover:underline"
                    style={{ color: 'var(--emp-text)' }}
                >
                    {employeeName(advance)}
                </Link>
                <p className="truncate text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                    {advance.employee?.document_type} {advance.employee?.document_number}
                </p>
            </div>

            <p className="line-clamp-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                {advance.reason}
            </p>

            <span className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatCurrency(advance.amount)}
            </span>

            <AdvanceBalanceCell advance={advance} />

            <span>
                <AdvanceStatePill advance={advance} />
            </span>

            <div className="flex items-center justify-end gap-0.5">
                <Link
                    href={route('advances.show', advance.id)}
                    aria-label={`Ver el anticipo de ${employeeName(advance)}`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <ArrowUpRight size={15} />
                </Link>
                <AdvanceActionsMenu advance={advance} onDelete={onDelete} />
            </div>
        </div>
    );
}

export default AdvanceRow;
