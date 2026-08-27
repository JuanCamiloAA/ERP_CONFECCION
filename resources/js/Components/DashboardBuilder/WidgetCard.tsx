import { Link } from '@inertiajs/react';
import { Code, PencilSimple, UsersThree } from '@phosphor-icons/react';
import {
    AssignmentPills,
    WidgetActionsMenu,
    WidgetTypeBadge,
    toggleWidget,
    type WidgetListRow,
} from '@/Components/DashboardBuilder/WidgetRow';
import { WidgetSwitch } from '@/Components/DashboardBuilder/WidgetSwitch';
import { formatRefresh, TYPE_LABELS } from '@/lib/dashboard-widgets';

interface Props {
    widget: WidgetListRow;
    onDelete: (widget: WidgetListRow) => void;
}

/**
 * Widget en móvil.
 *
 * La acción principal cambia con el estado del widget: si no lo ve nadie, lo que hace
 * falta no es editarlo otra vez sino asignarlo.
 */
export function WidgetCard({ widget, onDelete }: Props) {
    const unassigned = widget.visibility_count === 0;

    return (
        <article className={`emp-card p-[14px] ${widget.is_active ? '' : 'emp-row-off'}`}>
            <div className="flex items-start gap-2.5">
                <WidgetTypeBadge type={widget.type} active={widget.is_active} size={36} />

                <div className="min-w-0 flex-1">
                    <Link
                        href={route('super-admin.dashboard-widgets.edit', widget.id)}
                        className="block truncate text-[15px]"
                        style={{ color: 'var(--emp-text)' }}
                    >
                        {widget.title}
                    </Link>
                    <p
                        className="mt-0.5 truncate text-[11.5px]"
                        style={{ color: 'var(--emp-subtle)', fontFamily: 'ui-monospace, monospace' }}
                    >
                        {widget.query_summary}
                    </p>
                </div>

                <WidgetActionsMenu widget={widget} onDelete={onDelete} />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="emp-pill">
                    {TYPE_LABELS[widget.type] ?? widget.type}
                    {widget.query_mode === 'sql' ? ' · SQL' : ' · Guiado'}
                    {widget.query_mode === 'sql' ? <Code size={11} /> : null}
                </span>
                <span className="emp-pill">{formatRefresh(widget.refresh_interval_seconds)}</span>
                <AssignmentPills widget={widget} max={1} />
            </div>

            <div
                className="mt-3 flex items-center justify-between gap-3 pt-3"
                style={{ borderTop: '1px solid var(--emp-row)' }}
            >
                <div className="flex h-10 items-center gap-2">
                    <WidgetSwitch
                        checked={widget.is_active}
                        onChange={() => toggleWidget(widget)}
                        label={`${widget.is_active ? 'Desactivar' : 'Activar'} ${widget.title}`}
                        size="md"
                    />
                    <span className="text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                        {widget.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </div>

                {unassigned ? (
                    <Link
                        href={route('super-admin.dashboard-widgets.visibility', widget.id)}
                        className="emp-btn emp-btn-primary shrink-0"
                    >
                        <UsersThree size={17} />
                        Asignar
                    </Link>
                ) : (
                    <Link
                        href={route('super-admin.dashboard-widgets.edit', widget.id)}
                        className="emp-btn emp-btn-primary shrink-0"
                    >
                        <PencilSimple size={17} />
                        Editar
                    </Link>
                )}
            </div>
        </article>
    );
}

export default WidgetCard;
