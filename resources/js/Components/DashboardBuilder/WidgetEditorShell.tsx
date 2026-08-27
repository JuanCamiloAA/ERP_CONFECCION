import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ArrowUUpLeft, Copy, FloppyDisk, UsersThree } from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import { GeneratedSqlPanel } from '@/Components/DashboardBuilder/GeneratedSqlPanel';
import { PreviewPanel, useWidgetPreview } from '@/Components/DashboardBuilder/PreviewPanel';
import {
    WidgetFormFields,
    type WidgetFormData,
    type WidgetFormTab,
} from '@/Components/DashboardBuilder/WidgetFormFields';
import type { SessionVariableMeta, TableMeta } from '@/Components/DashboardBuilder/dashboard-builder-types';
import AppLayout from '@/Layouts/AppLayout';
import { assignmentSummary, describeQuery, TYPE_LONG_LABELS, type Assignment } from '@/lib/dashboard-widgets';
import { formatRelativeDate } from '@/lib/utils';

interface Props {
    mode: 'create' | 'edit';
    widgetId?: number;
    data: WidgetFormData;
    setData: <K extends keyof WidgetFormData>(key: K, value: WidgetFormData[K]) => void;
    errors: Partial<Record<string, string>>;
    processing: boolean;
    onSubmit: (event: FormEvent) => void;
    onReset: () => void;
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
    assignments?: Assignment[];
    visibilityCount?: number;
    initialSql?: string | null;
    savedAt?: string | null;
    onDuplicate?: () => void;
}

const TABS: { value: WidgetFormTab; label: string }[] = [
    { value: 'definition', label: 'Definición' },
    { value: 'appearance', label: 'Apariencia' },
];

/**
 * Cascarón del editor: cabecera, pestañas, formulario a la izquierda y el panel fijo a la
 * derecha.
 *
 * El panel vive aquí y no dentro del formulario para que la vista previa y el SQL sigan
 * visibles al cambiar de pestaña: era justo lo que obligaba a construir a ciegas, con la
 * vista previa enterrada al final de una tarjeta.
 */
export function WidgetEditorShell({
    mode,
    widgetId,
    data,
    setData,
    errors,
    processing,
    onSubmit,
    onReset,
    availableTables,
    availableSessionVariables,
    assignments = [],
    visibilityCount = 0,
    initialSql = null,
    savedAt = null,
    onDuplicate,
}: Props) {
    const [tab, setTab] = useState<WidgetFormTab>('definition');
    const preview = useWidgetPreview(data, initialSql);

    const heading = mode === 'create' ? 'Nuevo widget' : data.title || 'Widget';
    const summary = describeQuery(data.query_mode, data.query_definition, data.raw_sql, availableTables);
    const { visible, extra } = assignmentSummary(assignments, 3);

    const meta = [
        TYPE_LONG_LABELS[data.type],
        data.query_mode === 'builder' ? `consulta guiada sobre ${data.query_definition.table || '—'}` : 'SQL avanzado',
        mode === 'edit'
            ? `lo ven ${assignments.length} ${assignments.length === 1 ? 'empresa' : 'empresas'}`
            : 'sin asignar todavía',
        savedAt ? `guardado ${formatRelativeDate(savedAt)}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const sidePanel = (compact: boolean) => (
        <>
            <PreviewPanel form={data} preview={preview} compact={compact} />

            <GeneratedSqlPanel
                sql={preview.meta?.generated_sql ?? initialSql}
                hidden={data.query_mode === 'sql'}
            />

            {mode === 'edit' && widgetId ? (
                <section className="emp-card p-[15px_16px]">
                    <p className="emp-kicker">Quién lo verá</p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {assignments.length === 0 ? (
                            <span className="emp-pill emp-pill-warn">Nadie lo ve todavía</span>
                        ) : (
                            <>
                                {visible.map((assignment) => (
                                    <span key={assignment.company} className="emp-pill max-w-full truncate">
                                        {assignment.company} · {assignment.roles_label}
                                    </span>
                                ))}
                                {extra > 0 ? <span className="emp-pill">+{extra}</span> : null}
                            </>
                        )}
                    </div>

                    <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {assignments.length} {assignments.length === 1 ? 'empresa' : 'empresas'} · {visibilityCount}{' '}
                        {visibilityCount === 1 ? 'asignación' : 'asignaciones'}. Guardar el widget no cambia la
                        visibilidad; se guarda aparte.
                    </p>

                    <Link
                        href={route('super-admin.dashboard-widgets.visibility', widgetId)}
                        className="emp-btn emp-btn-sm mt-2.5"
                    >
                        <UsersThree size={14} />
                        Editar visibilidad
                    </Link>
                </section>
            ) : null}
        </>
    );

    return (
        <AppLayout title={heading}>
            <Head title={heading} />

            <form
                onSubmit={onSubmit}
                className="emp-form -m-4 min-h-screen px-4 pb-28 pt-5 sm:-m-6 sm:px-[34px] lg:-m-8 lg:pb-8"
            >
                {/* -------------------------------------------------- cabecera */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker flex flex-wrap items-center gap-1.5">
                            <Link href={route('super-admin.dashboard-widgets.index')} className="hover:underline">
                                Constructor de dashboards
                            </Link>
                            <span aria-hidden="true">›</span>
                            <span>{heading}</span>
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2.5">
                            <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                                {heading}
                            </h1>
                            <span className={`emp-pill ${data.is_active ? 'emp-pill-accent' : ''}`}>
                                {data.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                            {meta}
                        </p>
                        <p
                            className="mt-0.5 truncate text-[11.5px]"
                            style={{ color: 'var(--emp-subtle)', fontFamily: 'ui-monospace, monospace' }}
                        >
                            {summary}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 max-sm:hidden">
                        <Link href={route('super-admin.dashboard-widgets.index')} className="emp-btn emp-btn-sm">
                            <ArrowLeft size={14} />
                            Volver
                        </Link>
                        {mode === 'edit' && onDuplicate ? (
                            <button type="button" onClick={onDuplicate} className="emp-btn emp-btn-sm">
                                <Copy size={14} />
                                Duplicar
                            </button>
                        ) : null}
                        <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                            <FloppyDisk size={14} />
                            {processing ? 'Guardando…' : mode === 'create' ? 'Crear widget' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>

                {/* -------------------------------------------------- pestañas */}
                <div className="emp-seg mt-4 sm:w-[420px]">
                    {TABS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setTab(option.value)}
                            className={`emp-seg-item ${tab === option.value ? 'emp-seg-on' : ''}`}
                        >
                            {option.label}
                        </button>
                    ))}

                    {mode === 'edit' && widgetId ? (
                        <Link
                            href={route('super-admin.dashboard-widgets.visibility', widgetId)}
                            className="emp-seg-item flex items-center justify-center"
                        >
                            Visibilidad{visibilityCount > 0 ? ` · ${visibilityCount}` : ''}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            disabled
                            title="Disponible después de crear el widget"
                            className="emp-seg-item"
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        >
                            Visibilidad
                        </button>
                    )}
                </div>

                {mode === 'create' ? (
                    <p className="mt-1.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        La visibilidad se asigna después de crear el widget.
                    </p>
                ) : null}

                {/* Movil: la vista previa arriba, para no construir a ciegas. */}
                <div className="mt-4 flex flex-col gap-3 lg:hidden">{sidePanel(true)}</div>

                <div className="mt-4 flex items-start gap-[26px]">
                    <div className="min-w-0 flex-1">
                        <WidgetFormFields
                            data={data}
                            setData={setData}
                            errors={errors}
                            availableTables={availableTables}
                            availableSessionVariables={availableSessionVariables}
                            tab={tab}
                        />
                    </div>

                    <aside className="hidden w-[420px] shrink-0 flex-col gap-3 lg:sticky lg:top-[84px] lg:flex lg:self-start">
                        {sidePanel(false)}
                    </aside>
                </div>

                {/* Movil: guardar al alcance del pulgar. */}
                <div
                    className="emp-form fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
                    style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
                >
                    <button
                        type="button"
                        onClick={onReset}
                        aria-label="Descartar los cambios sin guardar"
                        className="emp-btn w-12 shrink-0 px-0"
                    >
                        <ArrowUUpLeft size={17} />
                    </button>
                    <button type="submit" disabled={processing} className="emp-btn emp-btn-primary flex-1">
                        <FloppyDisk size={17} />
                        {processing ? 'Guardando…' : mode === 'create' ? 'Crear widget' : 'Guardar cambios'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}

export default WidgetEditorShell;
