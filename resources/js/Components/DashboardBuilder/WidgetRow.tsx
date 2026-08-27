import { Link, router } from '@inertiajs/react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
    Code,
    Copy,
    DotsThreeVertical,
    Eye,
    EyeSlash,
    PencilSimple,
    Trash,
    UsersThree,
} from '@phosphor-icons/react';
import { Fragment } from 'react';
import { WidgetSwitch } from '@/Components/DashboardBuilder/WidgetSwitch';
import type { WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';
import { assignmentSummary, formatRefresh, TYPE_ICONS, TYPE_LABELS, type Assignment } from '@/lib/dashboard-widgets';

export interface WidgetListRow {
    id: number;
    name: string;
    title: string;
    type: WidgetType;
    query_mode: 'builder' | 'sql';
    query_summary: string;
    refresh_interval_seconds: number;
    is_active: boolean;
    visibility_count: number;
    assignments: Assignment[];
}

/** Reticula de la tabla, compartida por la cabecera y las filas. */
export const WIDGET_GRID = 'minmax(0,1fr) 110px 120px 210px 96px 92px 104px';

export function toggleWidget(widget: WidgetListRow) {
    router.patch(
        route('super-admin.dashboard-widgets.toggle-active', widget.id),
        {},
        { preserveScroll: true, preserveState: true },
    );
}

export function duplicateWidget(widget: WidgetListRow) {
    router.post(route('super-admin.dashboard-widgets.duplicate', widget.id), {}, { preserveScroll: true });
}

/** Cuadro con el icono del tipo; se apaga cuando el widget está inactivo. */
export function WidgetTypeBadge({ type, active, size = 34 }: { type: WidgetType; active: boolean; size?: number }) {
    const Icon = TYPE_ICONS[type];

    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-[10px] ${active ? 'emp-pill-accent' : ''}`}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                ...(active ? {} : { backgroundColor: 'var(--emp-field-alt)', color: 'var(--emp-subtle)' }),
            }}
        >
            <Icon size={size >= 36 ? 18 : 16} />
        </span>
    );
}

/** Pastillas de «Quién lo ve», o el aviso de que no lo ve nadie. */
export function AssignmentPills({ widget, max = 2 }: { widget: WidgetListRow; max?: number }) {
    if (widget.visibility_count === 0) {
        return (
            <div className="min-w-0">
                <span className="emp-pill emp-pill-warn">
                    <EyeSlash size={11} />
                    Nadie lo ve
                </span>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    Falta asignar empresa y rol
                </p>
            </div>
        );
    }

    const { visible, extra } = assignmentSummary(widget.assignments, max);

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
            {visible.map((assignment) => (
                <span key={assignment.company} className="emp-pill max-w-full truncate">
                    {assignment.company} · {assignment.roles_label}
                </span>
            ))}
            {extra > 0 ? <span className="emp-pill">+{extra}</span> : null}
        </div>
    );
}

export function WidgetActionsMenu({
    widget,
    onDelete,
}: {
    widget: WidgetListRow;
    onDelete: (widget: WidgetListRow) => void;
}) {
    const item =
        'flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] data-focus:bg-[color:var(--emp-accent-tint)]';

    return (
        <Menu as="div" className="relative shrink-0">
            <MenuButton
                aria-label={`Acciones del widget ${widget.title}`}
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
                    <MenuItem>
                        <Link href={route('dashboard')} className={item} style={{ color: 'var(--emp-text)' }}>
                            <Eye size={15} />
                            Ver en el dashboard
                        </Link>
                    </MenuItem>

                    <MenuItem>
                        <Link
                            href={route('super-admin.dashboard-widgets.visibility', widget.id)}
                            className={item}
                            style={{ color: 'var(--emp-text)' }}
                        >
                            <UsersThree size={15} />
                            Ver asignaciones
                        </Link>
                    </MenuItem>

                    <MenuItem>
                        <button
                            type="button"
                            onClick={() => onDelete(widget)}
                            className={item}
                            style={{ color: 'var(--emp-danger)' }}
                        >
                            <Trash size={15} />
                            Eliminar
                        </button>
                    </MenuItem>
                </MenuItems>
            </Transition>
        </Menu>
    );
}

interface Props {
    widget: WidgetListRow;
    onDelete: (widget: WidgetListRow) => void;
}

export function WidgetRow({ widget, onDelete }: Props) {
    return (
        <div
            className="emp-hover-row emp-row-sep grid items-center gap-2.5"
            style={{ gridTemplateColumns: WIDGET_GRID, padding: '11px 12px' }}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <WidgetTypeBadge type={widget.type} active={widget.is_active} />
                <div className="min-w-0">
                    <Link
                        href={route('super-admin.dashboard-widgets.edit', widget.id)}
                        className="block truncate text-[14px] hover:underline"
                        style={{ color: 'var(--emp-text)' }}
                    >
                        {widget.title}
                    </Link>
                    <p
                        className="truncate text-[11.5px]"
                        style={{ color: 'var(--emp-subtle)', fontFamily: 'ui-monospace, monospace' }}
                        title={widget.query_summary}
                    >
                        {widget.query_summary}
                    </p>
                </div>
            </div>

            <span className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                {TYPE_LABELS[widget.type] ?? widget.type}
            </span>

            <span>
                {widget.query_mode === 'sql' ? (
                    <span className="emp-pill">
                        <Code size={11} />
                        SQL avanzado
                    </span>
                ) : (
                    <span className="emp-pill emp-pill-accent">Guiado</span>
                )}
            </span>

            <AssignmentPills widget={widget} />

            <span className="text-right text-[12.5px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                {formatRefresh(widget.refresh_interval_seconds)}
            </span>

            <div className="flex items-center gap-2">
                <WidgetSwitch
                    checked={widget.is_active}
                    onChange={() => toggleWidget(widget)}
                    label={`${widget.is_active ? 'Desactivar' : 'Activar'} ${widget.title}`}
                />
                <span className="text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                    {widget.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </div>

            <div className="flex items-center justify-end gap-0.5">
                <Link
                    href={route('super-admin.dashboard-widgets.edit', widget.id)}
                    aria-label={`Editar ${widget.title}`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <PencilSimple size={15} />
                </Link>
                <button
                    type="button"
                    onClick={() => duplicateWidget(widget)}
                    aria-label={`Duplicar ${widget.title}`}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                    style={{ color: 'var(--emp-muted)' }}
                >
                    <Copy size={15} />
                </button>
                <WidgetActionsMenu widget={widget} onDelete={onDelete} />
            </div>
        </div>
    );
}

export default WidgetRow;
