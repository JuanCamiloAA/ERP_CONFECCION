import { Link } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import { Check, CheckCircle, DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react';
import { Fragment, type ReactNode } from 'react';
import { Can } from '@/Components/UI/Can';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Production } from '@/types';

/**
 * Reticula de la tabla, en el orden de las columnas.
 *
 * Se usa `grid` y no `<table>` porque la medida mezcla pixeles fijos con fracciones
 * (`68px … 1.6fr … 44px`), y eso una tabla con `table-layout: fixed` no lo reparte: o
 * respeta los pixeles o respeta las proporciones. Con grid las columnas de empleado y de
 * operacion crecen con la pantalla y las cifras conservan su ancho, que es justo lo que
 * evita el scroll horizontal a 1440px.
 */
const GRID_FULL = '68px 1.6fr 1.8fr 64px 72px 100px 72px 92px 44px';

/** En «Por día» la fecha sobra: el grupo ya la dice. */
const GRID_GROUPED = '1.5fr 1.9fr 64px 72px 100px 68px 88px 44px';

const SHIFT_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-08-21" -> "21 ago"; con el año solo si el filtro cruza años. */
export function shortDate(date: string | null | undefined, withYear = false): string {
    if (!date) return '—';
    const [y, m, d] = String(date).slice(0, 10).split('-');
    if (!y || !m || !d) return '—';

    const label = `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`;

    return withYear ? `${label} ${y}` : label;
}

/** Nombre del empleado: la base los tiene en minúscula y en mayúscula sostenida. */
export function employeeName(production: Production): string {
    const name = `${production.employee?.first_name ?? ''} ${production.employee?.last_name ?? ''}`.trim();

    return name || 'Sin empleado';
}

/** Estado como punto y texto: tres badges de color competían con las cifras. */
export function StatusMark({ status }: { status: string }) {
    if (status === 'pagado') {
        return (
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                <CheckCircle size={14} style={{ color: 'var(--emp-subtle)' }} />
                Pagado
            </span>
        );
    }

    if (status === 'confirmado') {
        return (
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                <Check size={13} style={{ color: 'var(--emp-accent-line)' }} />
                Confirmado
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--emp-accent-on)' }}>
            <span
                aria-hidden="true"
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--emp-accent)' }}
            />
            Pendiente
        </span>
    );
}

/** Menú de fila: editar, confirmar y eliminar, con sus permisos. */
export function RowMenu({
    production,
    onConfirm,
    onDelete,
}: {
    production: Production;
    onConfirm: (production: Production) => void;
    onDelete: (production: Production) => void;
}) {
    return (
        <Menu as="div" className="relative">
            <MenuButton
                aria-label="Acciones del registro"
                className="flex h-8 w-8 items-center justify-center rounded-lg"
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
                    className="emp-card z-50 w-44 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--emp-surface)' }}
                >
                    <Can permission="productions.index.edit">
                        <MenuItem>
                            <Link
                                href={route('productions.edit', production.id)}
                                className="flex h-10 items-center gap-2.5 px-3 text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                <PencilSimple size={15} />
                                Editar
                            </Link>
                        </MenuItem>
                    </Can>

                    {/* «Pagado» no se toca: ese estado lo pone el cierre de nómina. */}
                    {production.status === 'pendiente' ? (
                        <Can permission="productions.index.edit">
                            <MenuItem>
                                <button
                                    type="button"
                                    onClick={() => onConfirm(production)}
                                    className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]"
                                    style={{ color: 'var(--emp-text)' }}
                                >
                                    <Check size={15} />
                                    Confirmar
                                </button>
                            </MenuItem>
                        </Can>
                    ) : null}

                    <Can permission="productions.index.delete">
                        <MenuItem>
                            <button
                                type="button"
                                onClick={() => onDelete(production)}
                                className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]"
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

interface RowProps {
    production: Production;
    grouped?: boolean;
    showYear?: boolean;
    showCompany?: boolean;
    onConfirm: (production: Production) => void;
    onDelete: (production: Production) => void;
}

/** Iniciales del empleado; solo en «Por día», donde la fecha deja el hueco. */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/);

    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase() || '—';
}

export function ProductionRow({ production, grouped = false, showYear = false, showCompany = false, onConfirm, onDelete }: RowProps) {
    const name = employeeName(production);

    return (
        <div
            role="row"
            className="emp-hover-row emp-row-sep grid items-center gap-2.5 px-[17px] py-3"
            style={{ gridTemplateColumns: grouped ? GRID_GROUPED : GRID_FULL }}
        >
            {grouped ? null : (
                <span role="cell" className="text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                    {shortDate(String(production.date), showYear)}
                </span>
            )}

            <div role="cell" className="flex min-w-0 items-center gap-2">
                {grouped ? (
                    <span
                        aria-hidden="true"
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px]"
                        style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                    >
                        {initials(name)}
                    </span>
                ) : null}
                <span className="min-w-0">
                    <span className="block truncate text-[13px] capitalize" style={{ color: 'var(--emp-text)' }}>
                        {name}
                    </span>
                    {showCompany && production.company?.name ? (
                        <span className="block truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                            {production.company.name}
                        </span>
                    ) : null}
                </span>
            </div>

            {/* Operación y referencia son un solo dato compuesto, no dos columnas. */}
            <div role="cell" className="min-w-0">
                <span className="block truncate text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {production.operation?.name ?? '—'}
                </span>
                <span className="block truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {production.reference?.code} · {production.reference?.name}
                </span>
            </div>

            <span role="cell" className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatNumber(production.quantity)}
            </span>
            <span role="cell" className="text-right text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {formatCurrency(production.unit_price)}
            </span>
            <span role="cell" className="text-right text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                {formatCurrency(production.total_value)}
            </span>
            <span role="cell" className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                {SHIFT_LABEL[production.shift] ?? production.shift}
            </span>
            <span role="cell">
                <StatusMark status={production.status} />
            </span>
            <span role="cell" className="flex justify-end">
                <RowMenu production={production} onConfirm={onConfirm} onDelete={onDelete} />
            </span>
        </div>
    );
}

interface HeaderProps {
    grouped?: boolean;
}

export function ProductionTableHeader({ grouped = false }: HeaderProps) {
    const columns = grouped
        ? ['Empleado', 'Operación · referencia', 'Cant.', 'Precio', 'Valor', 'Turno', 'Estado', '']
        : ['Fecha', 'Empleado', 'Operación · referencia', 'Cant.', 'Precio', 'Valor', 'Turno', 'Estado', ''];

    const rightAligned = grouped ? [2, 3, 4] : [3, 4, 5];

    return (
        <div
            role="row"
            className="grid items-center gap-2.5 px-[17px] pb-2 pt-3"
            style={{ gridTemplateColumns: grouped ? GRID_GROUPED : GRID_FULL }}
        >
            {columns.map((label, index) => (
                <span
                    key={label || `col-${index}`}
                    role="columnheader"
                    className={`truncate text-[11px] uppercase tracking-[0.09em] ${rightAligned.includes(index) ? 'text-right' : ''}`}
                    style={{ color: 'var(--emp-subtle)' }}
                >
                    {label}
                </span>
            ))}
        </div>
    );
}

interface TableProps {
    children: ReactNode;
    /** Pie con los totales del filtro; en «Por día» va una sola vez al final. */
    totalQuantity: number;
    totalValue: number;
    /**
     * En «Por día» el contenido son secciones con su cabecera, no filas seguidas: se
     * omite  porque una tabla con secciones intercaladas se anuncia mal.
     */
    grouped?: boolean;
}

export function ProductionTable({ children, totalQuantity, totalValue, grouped = false }: TableProps) {
    return (
        <div role={grouped ? undefined : 'table'} className="emp-card overflow-hidden">
            {children}

            <div className="emp-strip flex items-center justify-between gap-4 px-[17px] py-3">
                <span className="text-[11px] uppercase tracking-[0.09em]" style={{ color: 'var(--emp-subtle)' }}>
                    Totales del filtro
                </span>
                <span className="flex items-center gap-5 text-[13px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    <span>
                        <span className="mr-1.5 text-[11px]" style={{ color: 'var(--emp-muted)' }}>
                            und
                        </span>
                        {formatNumber(totalQuantity)}
                    </span>
                    <span>{formatCurrency(totalValue)}</span>
                </span>
            </div>
        </div>
    );
}

export { GRID_FULL, GRID_GROUPED, SHIFT_LABEL };
