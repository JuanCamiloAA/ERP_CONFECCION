import { Link, router } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { ArrowCounterClockwise, Check, Copy, DotsThreeVertical, PencilSimple, Prohibit, Trash, X } from '@phosphor-icons/react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Can } from '@/Components/UI/Can';
import { usePermissions } from '@/contexts/PermissionsContext';
import { difficultyLabel } from '@/lib/difficulty';
import { formatCurrency } from '@/lib/utils';
import type { Operation } from '@/types';

export type OperationRowData = Operation & { references_count?: number; productions_count?: number };

/** Reticula de la tabla, compartida por la cabecera y las filas. */
export const OPERATION_GRID = '34px 1fr 150px 130px 110px 110px';

interface Props {
    operation: OperationRowData;
    selected: boolean;
    onToggleSelect: (id: number) => void;
    onDelete: (operation: OperationRowData) => void;
}

/** Cambia el estado de una sola operacion reutilizando el endpoint de acciones masivas. */
export function toggleOperationStatus(operation: OperationRowData) {
    router.post(
        route('operations.bulk-status'),
        { ids: [operation.id], is_active: !operation.is_active },
        { preserveScroll: true },
    );
}

/**
 * Menu de acciones de una operacion. Lo comparten la fila de escritorio y la tarjeta.
 */
export function OperationActionsMenu({
    operation,
    onDelete,
}: {
    operation: OperationRowData;
    onDelete: (operation: OperationRowData) => void;
}) {
    const item = 'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton
                aria-label={`Acciones de ${operation.name}`}
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
                    className="emp-card z-50 w-48 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--emp-surface)' }}
                >
                    <Can permission="operations.index.edit">
                        <MenuItem>
                            <Link href={route('operations.edit', operation.id)} className={item} style={{ color: 'var(--emp-text)' }}>
                                <PencilSimple size={15} />
                                Editar
                            </Link>
                        </MenuItem>
                    </Can>

                    <Can permission="operations.index.create">
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => router.post(route('operations.duplicate', operation.id))}
                                className={item}
                                style={{ color: 'var(--emp-text)' }}
                            >
                                <Copy size={15} />
                                Duplicar
                            </button>
                        </MenuItem>
                    </Can>

                    <Can permission="operations.index.edit">
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => toggleOperationStatus(operation)}
                                className={item}
                                style={{ color: 'var(--emp-text)' }}
                            >
                                {operation.is_active ? <Prohibit size={15} /> : <ArrowCounterClockwise size={15} />}
                                {operation.is_active ? 'Inactivar' : 'Reactivar'}
                            </button>
                        </MenuItem>
                    </Can>

                    <Can permission="operations.index.delete">
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => onDelete(operation)}
                                className={item}
                                style={{ color: 'var(--emp-danger)' }}
                            >
                                <Trash size={15} />
                                Eliminar
                            </button>
                        </MenuItem>
                    </Can>
                </MenuItems>
            </Transition>
        </Menu>
    );
}

/**
 * Precio editable sin salir del listado.
 *
 * Corregir una cifra no deberia costar dos pantallas. Se envia solo `base_price` a un
 * endpoint propio, de modo que la operacion no vuelve a pasar por la validacion del
 * formulario completo. Enter confirma, Escape cancela.
 */
export function OperationPriceCell({ operation }: { operation: OperationRowData }) {
    const perms = usePermissions();
    const canEdit = perms.can('operations.index.edit');

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(operation.base_price ?? ''));
    // Optimista: se pinta el valor nuevo al confirmar y se revierte si el servidor falla.
    const [shown, setShown] = useState<string | number>(operation.base_price);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setShown(operation.base_price);
    }, [operation.base_price]);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    if (!canEdit) {
        return (
            <span className="block text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatCurrency(shown)}
            </span>
        );
    }

    const open = () => {
        setDraft(String(operation.base_price ?? ''));
        setEditing(true);
    };

    const cancel = () => setEditing(false);

    const confirm = () => {
        const value = Number(draft);

        if (!Number.isFinite(value) || value < 0) {
            toast.error('El precio debe ser un número mayor o igual a cero.');

            return;
        }

        const previous = shown;
        setShown(value);
        setEditing(false);

        router.patch(
            route('operations.price', operation.id),
            { base_price: value },
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => {
                    setShown(previous);
                    toast.error('No se pudo actualizar el precio.');
                },
            },
        );
    };

    if (!editing) {
        return (
            <button
                type="button"
                onClick={open}
                aria-label={`Editar el precio de ${operation.name}`}
                className="group/price flex h-[30px] w-full items-center justify-end gap-1.5 rounded-lg px-1.5 text-[13px] tabular-nums"
                style={{ color: 'var(--emp-text)' }}
            >
                {formatCurrency(shown)}
                <PencilSimple size={13} style={{ color: 'var(--emp-faint)' }} />
            </button>
        );
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <div className="relative">
                <span
                    className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[12px]"
                    style={{ color: 'var(--emp-subtle)' }}
                >
                    $
                </span>
                <input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    min={0}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirm();
                        }
                        if (e.key === 'Escape') cancel();
                    }}
                    aria-label="Precio base"
                    className="emp-field w-[76px] pl-4 pr-1 text-right tabular-nums"
                    style={{ height: '30px', fontSize: '12.5px' }}
                />
            </div>
            <button
                type="button"
                onClick={confirm}
                aria-label="Guardar precio"
                className="emp-btn emp-btn-primary flex h-[30px] w-[30px] items-center justify-center px-0"
            >
                <Check size={13} />
            </button>
            <button
                type="button"
                onClick={cancel}
                aria-label="Cancelar"
                className="emp-btn emp-btn-ghost flex h-[30px] w-[30px] items-center justify-center px-0"
            >
                <X size={13} />
            </button>
        </div>
    );
}

/**
 * Fila del catalogo en escritorio.
 */
export function OperationRow({ operation, selected, onToggleSelect, onDelete }: Props) {
    return (
        <div
            className={`emp-hover-row emp-row-sep grid items-center gap-2.5 px-3 py-2.5 ${operation.is_active ? '' : 'emp-row-off'}`}
            style={{ gridTemplateColumns: OPERATION_GRID }}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(operation.id)}
                aria-label={`Seleccionar ${operation.name}`}
                className="h-4 w-4 cursor-pointer rounded"
                style={{ accentColor: 'var(--emp-accent)' }}
            />

            <div className="min-w-0">
                <Link
                    href={route('operations.show', operation.id)}
                    className="block truncate text-[14px] hover:underline"
                    style={{ color: 'var(--emp-text)' }}
                >
                    {operation.name}
                </Link>
                {operation.description ? (
                    <p className="truncate text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {operation.description}
                    </p>
                ) : null}
            </div>

            <OperationPriceCell operation={operation} />

            <span>
                <span className="emp-pill">{difficultyLabel(operation.difficulty_level)}</span>
            </span>

            <span>
                <span className={operation.is_active ? 'emp-pill' : 'emp-pill emp-pill-warn'}>
                    {operation.is_active ? 'Activa' : 'Inactiva'}
                </span>
            </span>

            <div className="flex items-center justify-end gap-0.5">
                <Can permission="operations.index.edit">
                    <Link
                        href={route('operations.edit', operation.id)}
                        aria-label={`Editar ${operation.name}`}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                        style={{ color: 'var(--emp-muted)' }}
                    >
                        <PencilSimple size={15} />
                    </Link>
                </Can>
                <Can permission="operations.index.create">
                    <button
                        type="button"
                        onClick={() => router.post(route('operations.duplicate', operation.id))}
                        aria-label={`Duplicar ${operation.name}`}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                        style={{ color: 'var(--emp-muted)' }}
                    >
                        <Copy size={15} />
                    </button>
                </Can>
                <OperationActionsMenu operation={operation} onDelete={onDelete} />
            </div>
        </div>
    );
}

export default OperationRow;
