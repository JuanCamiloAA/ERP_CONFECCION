import { router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { WidgetEditorShell } from '@/Components/DashboardBuilder/WidgetEditorShell';
import type { WidgetFormData } from '@/Components/DashboardBuilder/WidgetFormFields';
import type {
    QueryMode,
    SessionVariableMeta,
    TableMeta,
    WidgetType,
} from '@/Components/DashboardBuilder/dashboard-builder-types';
import type { Assignment } from '@/lib/dashboard-widgets';
import '../../../../css/module-ui.css';

interface WidgetRecord {
    id: number;
    name: string;
    title: string;
    description: string | null;
    type: WidgetType;
    query_mode: QueryMode;
    query_definition: WidgetFormData['query_definition'] | null;
    raw_sql: string | null;
    chart_config: WidgetFormData['chart_config'] | null;
    refresh_interval_seconds: number;
    is_active: boolean;
    updated_at?: string | null;
}

interface Props {
    widget: WidgetRecord;
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
    assignments: Assignment[];
    visibilityCount: number;
    generatedSql: string | null;
}

export default function DashboardWidgetEdit({
    widget,
    availableTables,
    availableSessionVariables,
    assignments,
    visibilityCount,
    generatedSql,
}: Props) {
    const initial: WidgetFormData = {
        name: widget.name,
        title: widget.title,
        description: widget.description ?? '',
        type: widget.type,
        query_mode: widget.query_mode,
        query_definition: widget.query_definition ?? { table: '', filters: [] },
        raw_sql: widget.raw_sql ?? '',
        chart_config: widget.chart_config ?? {},
        refresh_interval_seconds: widget.refresh_interval_seconds,
        is_active: widget.is_active,
    };

    const { data, setData, put, processing, errors, transform, reset } = useForm<WidgetFormData>(initial);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            query_definition: d.query_mode === 'builder' ? d.query_definition : null,
            raw_sql: d.query_mode === 'sql' ? d.raw_sql : null,
        }));
        put(route('super-admin.dashboard-widgets.update', widget.id));
    };

    return (
        <WidgetEditorShell
            mode="edit"
            widgetId={widget.id}
            data={data}
            setData={setData}
            errors={errors}
            processing={processing}
            onSubmit={submit}
            onReset={() => reset()}
            availableTables={availableTables}
            availableSessionVariables={availableSessionVariables}
            assignments={assignments}
            visibilityCount={visibilityCount}
            initialSql={generatedSql}
            savedAt={widget.updated_at ?? null}
            onDuplicate={() =>
                router.post(route('super-admin.dashboard-widgets.duplicate', widget.id), {}, { preserveScroll: true })
            }
        />
    );
}
