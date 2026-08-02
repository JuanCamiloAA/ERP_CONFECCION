import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { PageHeader } from '@/Components/UI/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { WidgetFormFields, type WidgetFormData } from '@/Components/DashboardBuilder/WidgetFormFields';
import type { SessionVariableMeta, TableMeta } from '@/Components/DashboardBuilder/dashboard-builder-types';

interface Props {
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
}

export default function DashboardWidgetCreate({ availableTables, availableSessionVariables }: Props) {
    const { data, setData, post, processing, errors, transform } = useForm<WidgetFormData>({
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
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            query_definition: d.query_mode === 'builder' ? d.query_definition : null,
            raw_sql: d.query_mode === 'sql' ? d.raw_sql : null,
        }));
        post(route('super-admin.dashboard-widgets.store'));
    };

    return (
        <AppLayout title="Nuevo widget">
            <Head title="Nuevo widget" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo widget de dashboard"
                    breadcrumbs={[
                        { label: 'Constructor de dashboards', href: route('super-admin.dashboard-widgets.index') },
                        { label: 'Nuevo' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('super-admin.dashboard-widgets.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" loading={processing}>
                                Crear
                            </Button>
                        </div>
                    }
                />

                <WidgetFormFields
                    data={data}
                    setData={setData}
                    errors={errors}
                    availableTables={availableTables}
                    availableSessionVariables={availableSessionVariables}
                />

                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tras crear el widget podras asignarle visibilidad por empresa y rol en la pantalla de edicion.
                </p>
            </form>
        </AppLayout>
    );
}
