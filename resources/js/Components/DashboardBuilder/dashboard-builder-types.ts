export type WidgetType = 'kpi' | 'bar' | 'line' | 'pie' | 'table';
export type QueryMode = 'builder' | 'sql';

export interface TableColumnMeta {
    key: string;
    label: string;
    type: 'integer' | 'number' | 'currency' | 'string' | 'date' | 'boolean';
    aggregatable: boolean;
    groupable: boolean;
}

/**
 * Condicion de negocio predefinida de una tabla. Existe porque hay criterios que no se
 * pueden escribir como filtro de columna: «pendiente de pago» necesita cruzar con los
 * periodos de nomina pagados.
 */
export interface TableScopeMeta {
    key: string;
    label: string;
    help?: string | null;
}

export interface TableMeta {
    key: string;
    label: string;
    has_company_scope: boolean;
    scopes?: TableScopeMeta[];
    columns: TableColumnMeta[];
}

export interface SessionVariableMeta {
    key: string;
    label: string;
}

export interface QueryFilter {
    column: string;
    operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like';
    /** 'literal': valor tal cual escrito. 'variable': `value` es la clave de una variable de sesion (ver SessionVariableMeta). */
    value_type?: 'literal' | 'variable';
    value: string;
}

export interface QueryDefinition {
    table: string;
    /** Claves de los filtros predefinidos activos (ver TableScopeMeta). */
    scopes?: string[];
    metric?: { column: string; aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' };
    group_by?: { column: string; granularity?: 'day' | 'week' | 'month' } | null;
    columns?: string[];
    filters?: QueryFilter[];
    order_by?: { column: string; direction: 'asc' | 'desc' } | null;
    limit?: number;
}

export interface WidgetDataPayload {
    value?: number;
    labels?: string[];
    series?: number[];
    columns?: string[];
    rows?: Array<Record<string, unknown>>;
}
