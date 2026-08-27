import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { WidgetEditorShell } from '@/Components/DashboardBuilder/WidgetEditorShell';
import type { WidgetFormData } from '@/Components/DashboardBuilder/WidgetFormFields';
import type { SessionVariableMeta, TableMeta } from '@/Components/DashboardBuilder/dashboard-builder-types';
import '../../../../css/module-ui.css';

interface Props {
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
}

const EMPTY: WidgetFormData = {
    name: '',
    title: '',
    description: '',
    type: 'kpi',
    query_mode: 'builder',
    query_definition: { table: '', filters: [] },
    raw_sql: '',
    chart_config: {},
    refresh_interval_seconds: 120,
    is_active: true,
};

export default function DashboardWidgetCreate({ availableTables, availableSessionVariables }: Props) {
    const { data, setData, post, processing, errors, transform, reset } = useForm<WidgetFormData>({ ...EMPTY });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // El modo que no se está usando viaja en null: guardar un SQL huérfano junto a una
        // definición guiada deja dos verdades sobre la misma consulta.
        transform((d) => ({
            ...d,
            query_definition: d.query_mode === 'builder' ? d.query_definition : null,
            raw_sql: d.query_mode === 'sql' ? d.raw_sql : null,
        }));
        post(route('super-admin.dashboard-widgets.store'));
    };

    return (
        <WidgetEditorShell
            mode="create"
            data={data}
            setData={setData}
            errors={errors}
            processing={processing}
            onSubmit={submit}
            onReset={() => reset()}
            availableTables={availableTables}
            availableSessionVariables={availableSessionVariables}
        />
    );
}
