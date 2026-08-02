import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Select } from '@/Components/UI/Select';
import type { QueryDefinition, QueryFilter, SessionVariableMeta, TableMeta, WidgetType } from './dashboard-builder-types';

interface GuidedQueryFormProps {
    availableTables: TableMeta[];
    availableSessionVariables: SessionVariableMeta[];
    type: WidgetType;
    value: QueryDefinition;
    onChange: (definition: QueryDefinition) => void;
    errors?: Record<string, string>;
}

const aggregationOptions = [
    { value: 'sum', label: 'Suma (SUM)' },
    { value: 'count', label: 'Conteo (COUNT)' },
    { value: 'avg', label: 'Promedio (AVG)' },
    { value: 'min', label: 'Minimo (MIN)' },
    { value: 'max', label: 'Maximo (MAX)' },
];

const operatorOptions = [
    { value: '=', label: 'Igual a (=)' },
    { value: '!=', label: 'Distinto de (!=)' },
    { value: '>', label: 'Mayor que (>)' },
    { value: '>=', label: 'Mayor o igual (>=)' },
    { value: '<', label: 'Menor que (<)' },
    { value: '<=', label: 'Menor o igual (<=)' },
    { value: 'like', label: 'Contiene (LIKE)' },
];

const granularityOptions = [
    { value: 'day', label: 'Por dia' },
    { value: 'week', label: 'Por semana' },
    { value: 'month', label: 'Por mes' },
];

export function GuidedQueryForm({ availableTables, availableSessionVariables, type, value, onChange, errors = {} }: GuidedQueryFormProps) {
    const selectedTable = useMemo(() => availableTables.find((t) => t.key === value.table), [availableTables, value.table]);
    const columns = selectedTable?.columns ?? [];
    const aggregatableColumns = columns.filter((c) => c.aggregatable);
    const groupableColumns = columns.filter((c) => c.groupable);

    const setTable = (table: string) => {
        onChange({ table, filters: value.filters ?? [] });
    };

    const setMetric = (column: string, aggregation: string) => {
        onChange({ ...value, metric: { column, aggregation: aggregation as 'sum' | 'count' | 'avg' | 'min' | 'max' } });
    };

    const setGroupBy = (column: string) => {
        if (!column) {
            onChange({ ...value, group_by: null });
            return;
        }
        const col = columns.find((c) => c.key === column);
        onChange({
            ...value,
            group_by: { column, granularity: col?.type === 'date' ? (value.group_by?.granularity ?? 'day') : undefined },
        });
    };

    const setGranularity = (granularity: string) => {
        if (!value.group_by) return;
        onChange({ ...value, group_by: { ...value.group_by, granularity: granularity as 'day' | 'week' | 'month' } });
    };

    const toggleTableColumn = (column: string) => {
        const current = value.columns ?? [];
        const next = current.includes(column) ? current.filter((c) => c !== column) : [...current, column];
        onChange({ ...value, columns: next });
    };

    const filters = value.filters ?? [];

    const updateFilter = (index: number, patch: Partial<QueryFilter>) => {
        const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
        onChange({ ...value, filters: next });
    };

    const addFilter = () => {
        onChange({
            ...value,
            filters: [...filters, { column: columns[0]?.key ?? '', operator: '=', value_type: 'literal', value: '' }],
        });
    };

    const removeFilter = (index: number) => {
        onChange({ ...value, filters: filters.filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <Select
                label="Tabla"
                value={value.table ?? ''}
                onChange={(e) => setTable(e.target.value)}
                options={availableTables.map((t) => ({ value: t.key, label: t.label }))}
                placeholder="Selecciona una tabla"
                error={errors.query_definition}
                required
            />

            {selectedTable && type !== 'table' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                        label="Columna (metrica)"
                        value={value.metric?.column ?? ''}
                        onChange={(e) => setMetric(e.target.value, value.metric?.aggregation ?? 'sum')}
                        options={aggregatableColumns.map((c) => ({ value: c.key, label: c.label }))}
                        placeholder="Selecciona una columna"
                        required
                    />
                    <Select
                        label="Agregacion"
                        value={value.metric?.aggregation ?? 'sum'}
                        onChange={(e) => setMetric(value.metric?.column ?? '', e.target.value)}
                        options={aggregationOptions}
                        required
                    />
                </div>
            )}

            {selectedTable && type !== 'table' && type !== 'kpi' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                        label="Agrupar por"
                        value={value.group_by?.column ?? ''}
                        onChange={(e) => setGroupBy(e.target.value)}
                        options={groupableColumns.map((c) => ({ value: c.key, label: c.label }))}
                        placeholder="Sin agrupacion"
                    />
                    {value.group_by && columns.find((c) => c.key === value.group_by?.column)?.type === 'date' && (
                        <Select
                            label="Granularidad"
                            value={value.group_by.granularity ?? 'day'}
                            onChange={(e) => setGranularity(e.target.value)}
                            options={granularityOptions}
                        />
                    )}
                </div>
            )}

            {selectedTable && type === 'table' && (
                <div>
                    <p className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Columnas a mostrar</p>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3 dark:border-slate-700">
                        {columns.map((c) => (
                            <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={(value.columns ?? []).includes(c.key)}
                                    onChange={() => toggleTableColumn(c.key)}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                />
                                {c.label}
                            </label>
                        ))}
                    </div>
                    {errors.query_definition && <p className="mt-1.5 text-xs text-rose-500">{errors.query_definition}</p>}
                    <Input
                        label="Limite de filas"
                        type="number"
                        min={1}
                        max={500}
                        className="mt-3 max-w-xs"
                        value={value.limit ?? 50}
                        onChange={(e) => onChange({ ...value, limit: Number(e.target.value) })}
                    />
                </div>
            )}

            {selectedTable && (
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtros</p>
                        <Button type="button" size="sm" variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={addFilter}>
                            Agregar filtro
                        </Button>
                    </div>
                    {filters.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin filtros (se incluyen todas las filas de la empresa).</p>
                    ) : (
                        <div className="space-y-3">
                            {filters.map((filter, index) => {
                                const valueType = filter.value_type ?? 'literal';
                                return (
                                    <div key={index} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]">
                                            <Select
                                                value={filter.column}
                                                onChange={(e) => updateFilter(index, { column: e.target.value })}
                                                options={columns.map((c) => ({ value: c.key, label: c.label }))}
                                                placeholder="Columna"
                                            />
                                            <Select
                                                value={filter.operator}
                                                onChange={(e) => updateFilter(index, { operator: e.target.value as QueryFilter['operator'] })}
                                                options={operatorOptions}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                onClick={() => removeFilter(index)}
                                            />
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={valueType === 'literal' ? 'primary' : 'secondary'}
                                                    onClick={() => updateFilter(index, { value_type: 'literal', value: '' })}
                                                >
                                                    Valor fijo
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={valueType === 'variable' ? 'primary' : 'secondary'}
                                                    onClick={() =>
                                                        updateFilter(index, {
                                                            value_type: 'variable',
                                                            value: availableSessionVariables[0]?.key ?? '',
                                                        })
                                                    }
                                                >
                                                    Variable de sesion
                                                </Button>
                                            </div>
                                            {valueType === 'variable' ? (
                                                <Select
                                                    value={filter.value}
                                                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                                                    options={availableSessionVariables.map((v) => ({ value: v.key, label: v.label }))}
                                                    placeholder="Selecciona una variable"
                                                />
                                            ) : (
                                                <Input value={filter.value} onChange={(e) => updateFilter(index, { value: e.target.value })} placeholder="Valor" />
                                            )}
                                        </div>
                                        {valueType === 'variable' && (
                                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                El valor se resuelve segun quien este viendo el dashboard (ej. cada empleado vera
                                                solo lo suyo).
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default GuidedQueryForm;
