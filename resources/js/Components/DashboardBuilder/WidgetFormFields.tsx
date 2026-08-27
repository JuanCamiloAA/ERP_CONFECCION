import { CheckCircle, Warning } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { GuidedQueryForm } from '@/Components/DashboardBuilder/GuidedQueryForm';
import { IconPicker } from '@/Components/DashboardBuilder/IconPicker';
import { WidgetSwitch } from '@/Components/DashboardBuilder/WidgetSwitch';
import { WidgetTypePicker } from '@/Components/DashboardBuilder/WidgetTypePicker';
import { KPI_COLOR_OPTIONS, REFRESH_PRESETS } from '@/lib/dashboard-widgets';
import type {
    QueryDefinition,
    QueryMode,
    SessionVariableMeta,
    TableMeta,
    WidgetType,
} from './dashboard-builder-types';

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

export type WidgetFormTab = 'definition' | 'appearance';

interface WidgetFormFieldsProps {
    data: WidgetFormData;
    setData: <K extends keyof WidgetFormData>(key: K, value: WidgetFormData[K]) => void;
    errors: Partial<Record<string, string>>;
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
    tab: WidgetFormTab;
}

/** Fila con interruptor dentro de un borde: el estado se lee y se cambia en el mismo sitio. */
function SwitchRow({
    checked,
    onChange,
    label,
    help,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    help?: string;
}) {
    return (
        <div
            className="flex items-center justify-between gap-3 rounded-[10px] p-3"
            style={{ border: '1px solid var(--emp-row)' }}
        >
            <div className="min-w-0">
                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {label}
                </p>
                {help ? (
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                        {help}
                    </p>
                ) : null}
            </div>
            <WidgetSwitch checked={checked} onChange={onChange} label={label} size="md" />
        </div>
    );
}

/** Chip de validación en vivo del SQL. El icono acompaña al color, nunca lo sustituye. */
function ValidationChip({ ok, children }: { ok: boolean; children: ReactNode }) {
    return (
        <span
            className="emp-pill"
            style={{
                borderColor: ok ? 'var(--emp-ok)' : 'var(--emp-danger)',
                color: ok ? 'var(--emp-ok)' : 'var(--emp-danger)',
            }}
        >
            {ok ? <CheckCircle size={11} /> : <Warning size={11} />}
            {children}
        </span>
    );
}

export function WidgetFormFields({
    data,
    setData,
    errors,
    availableTables,
    availableSessionVariables,
    tab,
}: WidgetFormFieldsProps) {
    const presetMatch = REFRESH_PRESETS.some((preset) => preset.seconds === data.refresh_interval_seconds);
    const [customRefresh, setCustomRefresh] = useState(! presetMatch);

    const sql = data.raw_sql ?? '';
    const trimmedSql = sql.trim();
    const isSingleSelect =
        /^select\b/i.test(trimmedSql) && ! trimmedSql.replace(/;+\s*$/, '').includes(';');
    const hasCompanyPlaceholder = sql.includes(':company_id');
    const hasSeriesAliases = /\blabel\b/i.test(sql) && /\bvalue\b/i.test(sql);
    const isSeriesType = data.type === 'bar' || data.type === 'line' || data.type === 'pie';

    if (tab === 'appearance') {
        return (
            <div className="flex flex-col gap-6">
                <EmployeeFormSection title="Apariencia">
                    <div className="flex flex-col gap-[14px]">
                        {data.type === 'kpi' ? (
                            <>
                                <div>
                                    <span className="emp-label">Icono de la tarjeta</span>
                                    <IconPicker
                                        value={data.chart_config?.icon ?? ''}
                                        onChange={(icon) => setData('chart_config', { ...data.chart_config, icon })}
                                    />
                                </div>

                                <div>
                                    <label className="emp-label" htmlFor="widget-subtitle">
                                        Subtítulo (opcional)
                                    </label>
                                    <input
                                        id="widget-subtitle"
                                        value={data.chart_config?.subtitle ?? ''}
                                        onChange={(e) =>
                                            setData('chart_config', { ...data.chart_config, subtitle: e.target.value })
                                        }
                                        placeholder="Texto corto debajo del valor"
                                        className="emp-field"
                                    />
                                </div>
                            </>
                        ) : null}

                        {data.type !== 'table' ? (
                            <div>
                                <span className="emp-label">
                                    {data.type === 'kpi' ? 'Color de la tarjeta' : 'Color de la serie'}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {KPI_COLOR_OPTIONS.map((option) => {
                                        const active = (data.chart_config?.color ?? 'indigo') === option.value;

                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() =>
                                                    setData('chart_config', { ...data.chart_config, color: option.value })
                                                }
                                                aria-pressed={active}
                                                aria-label={option.label}
                                                title={option.label}
                                                className="flex items-center justify-center rounded-[10px]"
                                                style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    border: `1px solid ${active ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                                    backgroundColor: active ? 'var(--emp-accent-fill)' : 'transparent',
                                                }}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="block rounded-full"
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        backgroundColor: option.swatch,
                                                    }}
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="emp-help">Es el color con el que se pinta en el dashboard del usuario.</p>
                            </div>
                        ) : null}

                        <SwitchRow
                            checked={Boolean(data.chart_config?.currency)}
                            onChange={(currency) => setData('chart_config', { ...data.chart_config, currency })}
                            label="Formatear el valor como moneda"
                            help="Aplica el formato de pesos colombianos a las cifras del widget."
                        />
                    </div>
                </EmployeeFormSection>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* --------------------------------------------- datos basicos */}
            <EmployeeFormSection title="Datos básicos">
                <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                    <div>
                        <label className="emp-label" htmlFor="widget-name">
                            Nombre interno <span className="emp-req">*</span>
                        </label>
                        <input
                            id="widget-name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className={`emp-field ${errors.name ? 'emp-field-error' : ''}`}
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                            required
                        />
                        {errors.name ? <p className="emp-error">{errors.name}</p> : null}
                        <p className="emp-help">Solo lo ve el super admin en el listado.</p>
                    </div>

                    <div>
                        <label className="emp-label" htmlFor="widget-title">
                            Título visible <span className="emp-req">*</span>
                        </label>
                        <input
                            id="widget-title"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            className={`emp-field ${errors.title ? 'emp-field-error' : ''}`}
                            required
                        />
                        {errors.title ? <p className="emp-error">{errors.title}</p> : null}
                        <p className="emp-help">Es el título que leen los usuarios en su Dashboard.</p>
                    </div>

                    <div className="sm:col-span-2">
                        <span className="emp-label">Tipo de widget</span>
                        <WidgetTypePicker value={data.type} onChange={(type) => setData('type', type)} />
                        {errors.type ? <p className="emp-error">{errors.type}</p> : null}
                    </div>

                    <div className="sm:col-span-2">
                        <span className="emp-label">Refresco</span>
                        <div className="flex flex-wrap items-start gap-2">
                            <div className="emp-seg sm:w-[380px]">
                                {REFRESH_PRESETS.map((preset) => {
                                    const active = ! customRefresh && data.refresh_interval_seconds === preset.seconds;

                                    return (
                                        <button
                                            key={preset.seconds}
                                            type="button"
                                            onClick={() => {
                                                setCustomRefresh(false);
                                                setData('refresh_interval_seconds', preset.seconds);
                                            }}
                                            className={`emp-seg-item ${active ? 'emp-seg-on' : ''}`}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setCustomRefresh(true)}
                                    className={`emp-seg-item ${customRefresh ? 'emp-seg-on' : ''}`}
                                >
                                    Otro
                                </button>
                            </div>

                            {customRefresh ? (
                                <div className="w-[130px]">
                                    <input
                                        type="number"
                                        min={15}
                                        max={3600}
                                        value={data.refresh_interval_seconds}
                                        onChange={(e) => setData('refresh_interval_seconds', Number(e.target.value))}
                                        aria-label="Intervalo de refresco en segundos"
                                        className="emp-field"
                                    />
                                </div>
                            ) : null}
                        </div>
                        {errors.refresh_interval_seconds ? (
                            <p className="emp-error">{errors.refresh_interval_seconds}</p>
                        ) : null}
                        <p className="emp-help">Cada cuánto vuelve a consultar el dashboard abierto (15 s – 60 min).</p>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="emp-label" htmlFor="widget-description">
                            Descripción
                        </label>
                        <textarea
                            id="widget-description"
                            rows={2}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            className="emp-field"
                        />
                        {errors.description ? <p className="emp-error">{errors.description}</p> : null}
                    </div>

                    <div className="sm:col-span-2">
                        <SwitchRow
                            checked={data.is_active}
                            onChange={(is_active) => setData('is_active', is_active)}
                            label="Widget activo"
                            help="Inactivo lo oculta en todos los dashboards sin borrar sus asignaciones."
                        />
                    </div>
                </div>
            </EmployeeFormSection>

            {/* -------------------------------------------------- consulta */}
            <EmployeeFormSection title="Consulta">
                <div className="emp-seg sm:w-[320px]">
                    <button
                        type="button"
                        onClick={() => setData('query_mode', 'builder')}
                        className={`emp-seg-item ${data.query_mode === 'builder' ? 'emp-seg-on' : ''}`}
                    >
                        Modo guiado
                    </button>
                    <button
                        type="button"
                        onClick={() => setData('query_mode', 'sql')}
                        className={`emp-seg-item ${data.query_mode === 'sql' ? 'emp-seg-on' : ''}`}
                    >
                        SQL avanzado
                    </button>
                </div>

                <div className="mt-4">
                    {data.query_mode === 'builder' ? (
                        <GuidedQueryForm
                            availableTables={availableTables}
                            availableSessionVariables={availableSessionVariables}
                            type={data.type}
                            value={data.query_definition}
                            onChange={(definition) => setData('query_definition', definition)}
                            errors={errors as Record<string, string>}
                        />
                    ) : (
                        <div>
                            <label className="emp-label" htmlFor="widget-sql">
                                SQL (solo SELECT) <span className="emp-req">*</span>
                            </label>
                            <textarea
                                id="widget-sql"
                                rows={7}
                                value={data.raw_sql}
                                onChange={(e) => setData('raw_sql', e.target.value)}
                                spellCheck={false}
                                placeholder="SELECT DATE(created_at) as label, SUM(quantity) as value FROM productions WHERE company_id = :company_id GROUP BY label"
                                className={`emp-field ${errors.raw_sql ? 'emp-field-error' : ''}`}
                                style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                            />
                            {errors.raw_sql ? <p className="emp-error">{errors.raw_sql}</p> : null}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                                <ValidationChip ok={isSingleSelect}>Una sola sentencia SELECT</ValidationChip>
                                <ValidationChip ok={hasCompanyPlaceholder}>
                                    Incluye <span style={{ fontFamily: 'ui-monospace, monospace' }}>:company_id</span>
                                </ValidationChip>
                                {isSeriesType ? (
                                    <ValidationChip ok={hasSeriesAliases}>
                                        Alias{' '}
                                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>label</span> y{' '}
                                        <span style={{ fontFamily: 'ui-monospace, monospace' }}>value</span>
                                    </ValidationChip>
                                ) : null}
                            </div>

                            <div className="emp-note mt-2.5">
                                Sin <span style={{ fontFamily: 'ui-monospace, monospace' }}>:company_id</span> el widget
                                solo puede usarse en la vista consolidada del super admin: no se podrá asignar a
                                empresas concretas.
                                {availableSessionVariables.length > 0 ? (
                                    <>
                                        {' '}
                                        Variables disponibles:{' '}
                                        {availableSessionVariables.map((variable, index) => (
                                            <span key={variable.key}>
                                                <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                                                    :{variable.key}
                                                </span>
                                                {index < availableSessionVariables.length - 1 ? ', ' : '.'}
                                            </span>
                                        ))}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </EmployeeFormSection>
        </div>
    );
}

export default WidgetFormFields;
