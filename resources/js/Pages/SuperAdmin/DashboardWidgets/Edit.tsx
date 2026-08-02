import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { WidgetFormFields, type WidgetFormData } from '@/Components/DashboardBuilder/WidgetFormFields';
import type { QueryMode, SessionVariableMeta, TableMeta, WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';

interface CompanyRow {
    id: number;
    name: string;
    is_active: boolean;
}

interface RoleRow {
    id: number;
    company_id: number;
    name: string;
    display_name: string;
}

interface VisibilityRow {
    id: number;
    company_id: number;
    role_id: number | null;
    position: number;
}

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
}

interface Props {
    widget: WidgetRecord;
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
    companies: CompanyRow[];
    rolesByCompany: Record<string, RoleRow[]>;
    visibility: VisibilityRow[];
}

export default function DashboardWidgetEdit({
    widget,
    availableTables,
    availableSessionVariables,
    companies,
    rolesByCompany,
    visibility,
}: Props) {
    const { data, setData, put, processing, errors, transform } = useForm<WidgetFormData>({
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
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            query_definition: d.query_mode === 'builder' ? d.query_definition : null,
            raw_sql: d.query_mode === 'sql' ? d.raw_sql : null,
        }));
        put(route('super-admin.dashboard-widgets.update', widget.id));
    };

    const [rows, setRows] = useState<{ company_id: number; role_id: number | null }[]>(
        visibility.map((v) => ({ company_id: v.company_id, role_id: v.role_id })),
    );
    const [visibilityErrors, setVisibilityErrors] = useState<string[]>([]);
    const [savingVisibility, setSavingVisibility] = useState(false);

    const isAllRolesSelected = (companyId: number) => rows.some((r) => r.company_id === companyId && r.role_id === null);
    const isRoleSelected = (companyId: number, roleId: number) => rows.some((r) => r.company_id === companyId && r.role_id === roleId);

    const toggleAllRoles = (companyId: number) => {
        setRows((prev) => {
            const without = prev.filter((r) => r.company_id !== companyId);
            return isAllRolesSelected(companyId) ? without : [...without, { company_id: companyId, role_id: null }];
        });
    };

    const toggleRole = (companyId: number, roleId: number) => {
        setRows((prev) => {
            const withoutAllRoles = prev.filter((r) => !(r.company_id === companyId && r.role_id === null));
            if (isRoleSelected(companyId, roleId)) {
                return withoutAllRoles.filter((r) => !(r.company_id === companyId && r.role_id === roleId));
            }
            return [...withoutAllRoles, { company_id: companyId, role_id: roleId }];
        });
    };

    const canFilterByCompany = useMemo(() => {
        if (data.query_mode === 'sql') {
            return data.raw_sql.includes(':company_id');
        }
        const table = availableTables.find((t) => t.key === data.query_definition.table);
        return Boolean(table?.has_company_scope);
    }, [data.query_mode, data.raw_sql, data.query_definition.table, availableTables]);

    const saveVisibility = () => {
        setSavingVisibility(true);
        setVisibilityErrors([]);
        router.put(
            route('super-admin.dashboard-widgets.visibility', widget.id),
            { visibility: rows.map((r, i) => ({ ...r, position: i })) },
            {
                preserveScroll: true,
                onError: (formErrors) => setVisibilityErrors(Object.values(formErrors) as string[]),
                onFinish: () => setSavingVisibility(false),
            },
        );
    };

    return (
        <AppLayout title="Editar widget">
            <Head title="Editar widget" />
            <div className="space-y-6">
                <form onSubmit={submit} className="space-y-6">
                    <PageHeader
                        title="Editar widget"
                        breadcrumbs={[
                            { label: 'Constructor de dashboards', href: route('super-admin.dashboard-widgets.index') },
                            { label: widget.title },
                        ]}
                        action={
                            <div className="flex gap-2">
                                <Link href={route('super-admin.dashboard-widgets.index')}>
                                    <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                        Volver
                                    </Button>
                                </Link>
                                <Button type="submit" loading={processing}>
                                    Guardar cambios
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
                </form>

                <Card>
                    <CardHeader
                        title="Visibilidad"
                        description="Que empresas y roles veran este widget en su Dashboard."
                    />

                    {!canFilterByCompany && (
                        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            Esta consulta no filtra por empresa (la tabla no tiene <code>company_id</code> o el SQL no incluye{' '}
                            <code>:company_id</code>). Solo puede usarse en la vista consolidada del super admin; no se puede
                            asignar a empresas especificas.
                        </p>
                    )}

                    {visibilityErrors.length > 0 && (
                        <ul className="mt-4 list-disc rounded-lg border border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                            {visibilityErrors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    )}

                    <div className="mt-4 space-y-3">
                        {companies.map((company) => {
                            const roles = rolesByCompany[String(company.id)] ?? [];
                            const selected = rows.some((r) => r.company_id === company.id);

                            return (
                                <div key={company.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-900 dark:text-slate-100">{company.name}</span>
                                            {!company.is_active && <Badge variant="neutral">Inactiva</Badge>}
                                            {selected && <Badge variant="success">Asignado</Badge>}
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={isAllRolesSelected(company.id)}
                                                onChange={() => toggleAllRoles(company.id)}
                                                disabled={!canFilterByCompany}
                                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                            />
                                            Todos los roles
                                        </label>
                                    </div>

                                    {roles.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3 dark:border-slate-700">
                                            {roles.map((role) => (
                                                <label
                                                    key={role.id}
                                                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isRoleSelected(company.id, role.id)}
                                                        onChange={() => toggleRole(company.id, role.id)}
                                                        disabled={!canFilterByCompany || isAllRolesSelected(company.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                                    />
                                                    {role.display_name || role.name}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
                        <Button type="button" loading={savingVisibility} disabled={!canFilterByCompany} onClick={saveVisibility}>
                            Guardar visibilidad
                        </Button>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
