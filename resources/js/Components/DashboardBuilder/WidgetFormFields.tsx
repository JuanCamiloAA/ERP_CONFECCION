import axios from 'axios';
import { useState } from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import { PlayIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { DynamicChart } from '@/Components/Dashboard/DynamicChart';
import { GuidedQueryForm } from '@/Components/DashboardBuilder/GuidedQueryForm';
import type { QueryDefinition, QueryMode, SessionVariableMeta, TableMeta, WidgetDataPayload, WidgetType } from './dashboard-builder-types';

export interface WidgetFormData {
    name: string;
    title: string;
    description: string;
    type: WidgetType;
    query_mode: QueryMode;
    query_definition: QueryDefinition;
    raw_sql: string;
    chart_config: { currency?: boolean; icon?: string; color?: string; subtitle?: string };
    refresh_interval_seconds: number;
    is_active: boolean;
}

const KPI_COLOR_OPTIONS = [
    { value: 'indigo', label: 'Indigo' },
    { value: 'emerald', label: 'Verde' },
    { value: 'amber', label: 'Ambar' },
    { value: 'rose', label: 'Rosa' },
    { value: 'sky', label: 'Celeste' },
];

const KPI_ICON_OPTIONS = [
    'ClipboardDocumentListIcon',
    'ClipboardDocumentIcon',
    'CurrencyDollarIcon',
    'BanknotesIcon',
    'CreditCardIcon',
    'ReceiptPercentIcon',
    'UsersIcon',
    'UserGroupIcon',
    'UserPlusIcon',
    'BuildingOfficeIcon',
    'BuildingLibraryIcon',
    'ChartBarIcon',
    'ChartPieIcon',
    'PresentationChartLineIcon',
    'ClockIcon',
    'CalendarDaysIcon',
    'TagIcon',
    'WrenchScrewdriverIcon',
    'ClipboardDocumentCheckIcon',
    'CheckCircleIcon',
    'ExclamationTriangleIcon',
    'ShieldCheckIcon',
    'DocumentTextIcon',
    'TruckIcon',
    'BriefcaseIcon',
    'ScaleIcon',
    'SparklesIcon',
] as const;

interface WidgetFormFieldsProps {
    data: WidgetFormData;
    setData: <K extends keyof WidgetFormData>(key: K, value: WidgetFormData[K]) => void;
    errors: Partial<Record<string, string>>;
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
}

const typeOptions = [
    { value: 'kpi', label: 'Tarjeta KPI' },
    { value: 'bar', label: 'Grafico de barras' },
    { value: 'line', label: 'Grafico de lineas' },
    { value: 'pie', label: 'Grafico de torta' },
    { value: 'table', label: 'Tabla de datos' },
];

export function WidgetFormFields({ data, setData, errors, availableTables, availableSessionVariables }: WidgetFormFieldsProps) {
    const [previewData, setPreviewData] = useState<WidgetDataPayload | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const runPreview = async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const { data: result } = await axios.post<WidgetDataPayload>(
                route('super-admin.dashboard-widgets.preview'),
                {
                    type: data.type,
                    query_mode: data.query_mode,
                    query_definition: data.query_definition,
                    raw_sql: data.raw_sql,
                },
                { headers: { Accept: 'application/json' } },
            );
            setPreviewData(result);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                setPreviewError((error.response?.data as { message?: string } | undefined)?.message ?? 'No se pudo previsualizar la consulta.');
            } else {
                setPreviewError('No se pudo previsualizar la consulta.');
            }
            setPreviewData(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title="Datos basicos" />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Nombre interno"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={errors.name}
                        description="Solo lo ve el super admin en el listado."
                        required
                    />
                    <Input
                        label="Titulo (visible para usuarios)"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        error={errors.title}
                        required
                    />
                    <Select
                        label="Tipo de widget"
                        value={data.type}
                        onChange={(e) => setData('type', e.target.value as WidgetType)}
                        options={typeOptions}
                        required
                    />
                    <Input
                        label="Intervalo de refresco (segundos)"
                        type="number"
                        min={15}
                        max={3600}
                        value={data.refresh_interval_seconds}
                        onChange={(e) => setData('refresh_interval_seconds', Number(e.target.value))}
                        error={errors.refresh_interval_seconds}
                    />
                    <Textarea
                        label="Descripcion"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        error={errors.description}
                        className="sm:col-span-2"
                        rows={2}
                    />
                    <div className="sm:col-span-2">
                        <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Widget activo" />
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Consulta"
                    description="Modo guiado (recomendado) o SQL avanzado (solo SELECT)."
                />
                <div className="mt-4 flex gap-2">
                    <Button
                        type="button"
                        variant={data.query_mode === 'builder' ? 'primary' : 'secondary'}
                        onClick={() => setData('query_mode', 'builder')}
                    >
                        Modo guiado
                    </Button>
                    <Button
                        type="button"
                        variant={data.query_mode === 'sql' ? 'primary' : 'secondary'}
                        onClick={() => setData('query_mode', 'sql')}
                    >
                        SQL avanzado
                    </Button>
                </div>

                <div className="mt-4">
                    {data.query_mode === 'builder' ? (
                        <GuidedQueryForm
                            availableTables={availableTables}
                            availableSessionVariables={availableSessionVariables}
                            type={data.type}
                            value={data.query_definition}
                            onChange={(def) => setData('query_definition', def)}
                            errors={errors as Record<string, string>}
                        />
                    ) : (
                        <div className="space-y-2">
                            <Textarea
                                label="SQL (solo SELECT)"
                                value={data.raw_sql}
                                onChange={(e) => setData('raw_sql', e.target.value)}
                                error={errors.raw_sql}
                                rows={6}
                                className="font-mono text-xs"
                                placeholder="SELECT DATE(created_at) as label, SUM(quantity) as value FROM productions WHERE company_id = :company_id GROUP BY label"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Solo se permite una sentencia <code>SELECT</code> (sin <code>;</code> intermedios ni palabras de
                                escritura/DDL). Si vas a asignar este widget a una empresa especifica, el SQL debe incluir el
                                placeholder literal <code>:company_id</code>; de lo contrario solo podra usarse en la vista
                                consolidada del super admin.
                            </p>
                            {availableSessionVariables.length > 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Tambien puedes usar estos placeholders (se resuelven segun quien vea el dashboard):{' '}
                                    {availableSessionVariables.map((v, i) => (
                                        <span key={v.key}>
                                            <code>:{v.key}</code>
                                            {i < availableSessionVariables.length - 1 ? ', ' : ''}
                                        </span>
                                    ))}
                                    .
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-4 space-y-4">
                    <Switch
                        checked={Boolean(data.chart_config?.currency)}
                        onChange={(v) => setData('chart_config', { ...data.chart_config, currency: v })}
                        label="Formatear valores como moneda"
                    />

                    {data.type === 'kpi' && (
                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                                Apariencia de la tarjeta (igual estilo que las tarjetas por defecto)
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Select
                                    label="Icono"
                                    value={data.chart_config?.icon ?? ''}
                                    onChange={(e) => setData('chart_config', { ...data.chart_config, icon: e.target.value })}
                                    options={KPI_ICON_OPTIONS.map((name) => ({ value: name, label: name.replace(/Icon$/, '') }))}
                                    placeholder="Sin icono"
                                />
                                <Select
                                    label="Color"
                                    value={data.chart_config?.color ?? 'indigo'}
                                    onChange={(e) => setData('chart_config', { ...data.chart_config, color: e.target.value })}
                                    options={KPI_COLOR_OPTIONS}
                                />
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                                {data.chart_config?.icon && (() => {
                                    const Icon = (HeroIcons as unknown as Record<string, typeof HeroIcons.SparklesIcon>)[data.chart_config.icon];
                                    return Icon ? (
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                                            <Icon className="h-6 w-6" />
                                        </div>
                                    ) : null;
                                })()}
                                <Input
                                    label="Subtitulo (opcional)"
                                    value={data.chart_config?.subtitle ?? ''}
                                    onChange={(e) => setData('chart_config', { ...data.chart_config, subtitle: e.target.value })}
                                    placeholder="Texto corto debajo del valor"
                                    containerClassName="flex-1"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Vista previa en vivo</p>
                        <Button type="button" size="sm" icon={<PlayIcon className="h-4 w-4" />} loading={previewLoading} onClick={runPreview}>
                            Probar consulta
                        </Button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Se ejecuta con la empresa seleccionada actualmente en el selector superior (o consolidado si no hay
                        ninguna elegida).
                    </p>
                    <div className="mt-3 h-64 min-h-64 w-full min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        {previewError ? (
                            <p className="flex h-full items-center justify-center text-center text-sm text-rose-500">{previewError}</p>
                        ) : (
                            <DynamicChart type={data.type} data={previewData} config={data.chart_config} title={data.title || 'Vista previa'} />
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

export default WidgetFormFields;
