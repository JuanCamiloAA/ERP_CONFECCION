import { CaretDown, CheckCircle, Plus, Trash, Warning } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';
import type {
    QueryDefinition,
    QueryFilter,
    SessionVariableMeta,
    TableMeta,
    WidgetType,
} from './dashboard-builder-types';

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
    { value: 'min', label: 'Mínimo (MIN)' },
    { value: 'max', label: 'Máximo (MAX)' },
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
    { value: 'day', label: 'Por día' },
    { value: 'week', label: 'Por semana' },
    { value: 'month', label: 'Por mes' },
];

const FILTER_GRID = 'minmax(0,1fr) 168px 150px minmax(0,1fr) 30px';

/** Desplegable con la flecha del módulo; `emp-field` ya oculta la nativa. */
function Dropdown({
    id,
    label,
    value,
    onChange,
    children,
    help,
}: {
    id: string;
    label?: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
    help?: ReactNode;
}) {
    return (
        <div className="min-w-0">
            {label ? (
                <label className="emp-label" htmlFor={id}>
                    {label}
                </label>
            ) : null}
            <div className="relative">
                <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={label}
                    className="emp-field"
                >
                    {children}
                </select>
                <CaretDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--emp-subtle)' }}
                />
            </div>
            {help}
        </div>
    );
}

/**
 * Consulta guiada. La lógica es la misma de siempre —tabla, métrica, agrupación, filtros
 * predefinidos y filtros por columna—; lo que cambia es que ahora se ve de dónde sale el
 * dato y si la tabla filtra por empresa antes de guardar nada.
 */
export function GuidedQueryForm({
    availableTables,
    availableSessionVariables,
    type,
    value,
    onChange,
    errors = {},
}: GuidedQueryFormProps) {
    const selectedTable = useMemo(
        () => availableTables.find((t) => t.key === value.table),
        [availableTables, value.table],
    );
    const columns = selectedTable?.columns ?? [];
    const aggregatableColumns = columns.filter((c) => c.aggregatable);
    const groupableColumns = columns.filter((c) => c.groupable);

    const setTable = (table: string) => {
        // Los filtros predefinidos pertenecen a la tabla: al cambiarla dejan de aplicar.
        onChange({ table, filters: value.filters ?? [] });
    };

    const scopes = value.scopes ?? [];

    const toggleScope = (key: string) => {
        onChange({
            ...value,
            scopes: scopes.includes(key) ? scopes.filter((s) => s !== key) : [...scopes, key],
        });
    };

    const setMetric = (column: string, aggregation: string) => {
        onChange({
            ...value,
            metric: { column, aggregation: aggregation as 'sum' | 'count' | 'avg' | 'min' | 'max' },
        });
    };

    const setGroupBy = (column: string) => {
        if (! column) {
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
        if (! value.group_by) return;
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

    const scopeList = selectedTable?.scopes ?? [];

    return (
        <div className="flex flex-col gap-4">
            {/* ------------------------------------------ tabla y metrica */}
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
                <Dropdown
                    id="guided-table"
                    label="Tabla"
                    value={value.table ?? ''}
                    onChange={setTable}
                    help={
                        selectedTable ? (
                            <p
                                className="mt-1 flex items-center gap-1 text-[11px]"
                                style={{
                                    color: selectedTable.has_company_scope ? 'var(--emp-ok)' : 'var(--emp-danger)',
                                }}
                            >
                                {selectedTable.has_company_scope ? <CheckCircle size={12} /> : <Warning size={12} />}
                                {selectedTable.has_company_scope
                                    ? 'Filtra por empresa automáticamente'
                                    : 'Esta tabla no tiene company_id'}
                            </p>
                        ) : (
                            <p className="emp-help">De aquí sale el dato del widget.</p>
                        )
                    }
                >
                    <option value="">Selecciona una tabla</option>
                    {availableTables.map((table) => (
                        <option key={table.key} value={table.key}>
                            {table.label}
                        </option>
                    ))}
                </Dropdown>

                {selectedTable && type !== 'table' ? (
                    <>
                        <Dropdown
                            id="guided-metric-column"
                            label="Columna (métrica)"
                            value={value.metric?.column ?? ''}
                            onChange={(column) => setMetric(column, value.metric?.aggregation ?? 'sum')}
                        >
                            <option value="">Selecciona una columna</option>
                            {aggregatableColumns.map((column) => (
                                <option key={column.key} value={column.key}>
                                    {column.label}
                                </option>
                            ))}
                        </Dropdown>

                        <Dropdown
                            id="guided-aggregation"
                            label="Agregación"
                            value={value.metric?.aggregation ?? 'sum'}
                            onChange={(aggregation) => setMetric(value.metric?.column ?? '', aggregation)}
                        >
                            {aggregationOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Dropdown>
                    </>
                ) : null}
            </div>

            {errors.query_definition ? <p className="emp-error">{errors.query_definition}</p> : null}

            {/* ------------------------------------------------ agrupacion */}
            {selectedTable && type !== 'table' && type !== 'kpi' ? (
                <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                    <Dropdown
                        id="guided-group"
                        label="Agrupar por"
                        value={value.group_by?.column ?? ''}
                        onChange={setGroupBy}
                    >
                        <option value="">Sin agrupación</option>
                        {groupableColumns.map((column) => (
                            <option key={column.key} value={column.key}>
                                {column.label}
                            </option>
                        ))}
                    </Dropdown>

                    {value.group_by && columns.find((c) => c.key === value.group_by?.column)?.type === 'date' ? (
                        <Dropdown
                            id="guided-granularity"
                            label="Granularidad"
                            value={value.group_by.granularity ?? 'day'}
                            onChange={setGranularity}
                        >
                            {granularityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Dropdown>
                    ) : null}
                </div>
            ) : null}

            {/* --------------------------------------- columnas de la tabla */}
            {selectedTable && type === 'table' ? (
                <div>
                    <span className="emp-label">Columnas a mostrar</span>
                    <div
                        className="grid grid-cols-2 gap-2 rounded-[10px] p-3 sm:grid-cols-3"
                        style={{ border: '1px solid var(--emp-border)' }}
                    >
                        {columns.map((column) => (
                            <label
                                key={column.key}
                                className="flex cursor-pointer items-center gap-2 text-[12.5px]"
                                style={{ color: 'var(--emp-text)' }}
                            >
                                <input
                                    type="checkbox"
                                    checked={(value.columns ?? []).includes(column.key)}
                                    onChange={() => toggleTableColumn(column.key)}
                                    className="h-4 w-4 shrink-0 rounded"
                                    style={{ accentColor: 'var(--emp-accent)' }}
                                />
                                <span className="truncate">{column.label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="mt-3 max-w-[200px]">
                        <label className="emp-label" htmlFor="guided-limit">
                            Límite de filas
                        </label>
                        <input
                            id="guided-limit"
                            type="number"
                            min={1}
                            max={500}
                            value={value.limit ?? 50}
                            onChange={(e) => onChange({ ...value, limit: Number(e.target.value) })}
                            className="emp-field"
                        />
                    </div>
                </div>
            ) : null}

            {/* ------------------------------------- filtros predefinidos */}
            {selectedTable && scopeList.length > 0 ? (
                <div>
                    <span className="emp-label">Filtros predefinidos</span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {scopeList.map((scope) => {
                            const active = scopes.includes(scope.key);

                            return (
                                <label
                                    key={scope.key}
                                    className="flex cursor-pointer gap-2.5 rounded-[10px] p-3"
                                    style={{
                                        border: `1px solid ${active ? 'var(--emp-accent)' : 'var(--emp-border)'}`,
                                        backgroundColor: active ? 'var(--emp-accent-tint)' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={active}
                                        onChange={() => toggleScope(scope.key)}
                                        className="mt-0.5 h-4 w-4 shrink-0 rounded"
                                        style={{ accentColor: 'var(--emp-accent)' }}
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                            {scope.label}
                                        </span>
                                        {scope.help ? (
                                            <span
                                                className="mt-0.5 block text-[11px] leading-relaxed"
                                                style={{ color: 'var(--emp-subtle)' }}
                                            >
                                                {scope.help}
                                            </span>
                                        ) : null}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {/* ------------------------------------------ filtros por columna */}
            {selectedTable ? (
                <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>Filtros por columna</span>
                        <button type="button" onClick={addFilter} className="emp-btn emp-btn-sm">
                            <Plus size={13} />
                            Agregar filtro
                        </button>
                    </div>

                    {filters.length === 0 ? (
                        <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                            Sin filtros: entran todas las filas de la empresa.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filters.map((filter, index) => {
                                const valueType = filter.value_type ?? 'literal';
                                const columnType = columns.find((c) => c.key === filter.column)?.type;

                                return (
                                    <div
                                        key={index}
                                        className="grid grid-cols-1 items-end gap-2 lg:grid-cols-[var(--filter-grid)]"
                                        style={{ ['--filter-grid' as string]: FILTER_GRID }}
                                    >
                                        <Dropdown
                                            id={`filter-column-${index}`}
                                            label={index === 0 ? 'Columna' : undefined}
                                            value={filter.column}
                                            onChange={(column) => updateFilter(index, { column })}
                                        >
                                            <option value="">Columna</option>
                                            {columns.map((column) => (
                                                <option key={column.key} value={column.key}>
                                                    {column.label}
                                                </option>
                                            ))}
                                        </Dropdown>

                                        <Dropdown
                                            id={`filter-operator-${index}`}
                                            label={index === 0 ? 'Operador' : undefined}
                                            value={filter.operator}
                                            onChange={(operator) =>
                                                updateFilter(index, { operator: operator as QueryFilter['operator'] })
                                            }
                                        >
                                            {operatorOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </Dropdown>

                                        <div className="min-w-0">
                                            {index === 0 ? <span className="emp-label">Tipo de valor</span> : null}
                                            <div className="emp-seg">
                                                <button
                                                    type="button"
                                                    onClick={() => updateFilter(index, { value_type: 'literal', value: '' })}
                                                    className={`emp-seg-item ${valueType === 'literal' ? 'emp-seg-on' : ''}`}
                                                >
                                                    Valor fijo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateFilter(index, {
                                                            value_type: 'variable',
                                                            value: availableSessionVariables[0]?.key ?? '',
                                                        })
                                                    }
                                                    className={`emp-seg-item ${valueType === 'variable' ? 'emp-seg-on' : ''}`}
                                                >
                                                    Variable
                                                </button>
                                            </div>
                                        </div>

                                        {valueType === 'variable' ? (
                                            <div className="min-w-0">
                                                {index === 0 ? (
                                                    <label className="emp-label" htmlFor={`filter-value-${index}`}>
                                                        Variable de sesión
                                                    </label>
                                                ) : null}
                                                <div className="relative">
                                                    <select
                                                        id={`filter-value-${index}`}
                                                        value={filter.value}
                                                        onChange={(e) => updateFilter(index, { value: e.target.value })}
                                                        aria-label="Variable de sesión del filtro"
                                                        className="emp-field"
                                                        style={{
                                                            borderColor: 'var(--emp-accent)',
                                                            fontFamily: 'ui-monospace, monospace',
                                                            fontSize: '12px',
                                                        }}
                                                    >
                                                        <option value="">Selecciona una variable</option>
                                                        {availableSessionVariables.map((variable) => (
                                                            <option key={variable.key} value={variable.key}>
                                                                :{variable.key}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <CaretDown
                                                        size={13}
                                                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                                        style={{ color: 'var(--emp-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="min-w-0">
                                                {index === 0 ? (
                                                    <label className="emp-label" htmlFor={`filter-value-${index}`}>
                                                        Valor
                                                    </label>
                                                ) : null}
                                                <input
                                                    id={`filter-value-${index}`}
                                                    type={columnType === 'date' ? 'date' : 'text'}
                                                    value={filter.value}
                                                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                                                    placeholder="Valor"
                                                    aria-label="Valor del filtro"
                                                    className="emp-field"
                                                />
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => removeFilter(index)}
                                            aria-label={`Quitar el filtro ${index + 1}`}
                                            className="flex h-[38px] w-[30px] items-center justify-center rounded-lg max-lg:h-11 max-lg:w-full"
                                            style={{ color: 'var(--emp-danger)' }}
                                        >
                                            <Trash size={15} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {filters.some((f) => (f.value_type ?? 'literal') === 'variable') ? (
                        <div className="emp-note mt-2.5">
                            Con una variable de sesión el valor se resuelve según quien mire el dashboard: cada empleado
                            verá solo lo suyo, sin duplicar el widget por persona.
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default GuidedQueryForm;
