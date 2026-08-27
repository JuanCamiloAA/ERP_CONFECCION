import { ChartBar, ChartLine, ChartPie, Gauge, Table, type Icon } from '@phosphor-icons/react';
import type {
    QueryDefinition,
    QueryMode,
    TableMeta,
    WidgetType,
} from '@/Components/DashboardBuilder/dashboard-builder-types';

export const TYPE_LABELS: Record<WidgetType, string> = {
    kpi: 'KPI',
    bar: 'Barras',
    line: 'Líneas',
    pie: 'Torta',
    table: 'Tabla',
};

/** Etiqueta larga, para el selector de tipo del editor. */
export const TYPE_LONG_LABELS: Record<WidgetType, string> = {
    kpi: 'Tarjeta KPI',
    bar: 'Gráfico de barras',
    line: 'Gráfico de líneas',
    pie: 'Gráfico de torta',
    table: 'Tabla de datos',
};

export const TYPE_ICONS: Record<WidgetType, Icon> = {
    kpi: Gauge,
    bar: ChartBar,
    line: ChartLine,
    pie: ChartPie,
    table: Table,
};

export const WIDGET_TYPES: WidgetType[] = ['kpi', 'bar', 'line', 'pie', 'table'];

/** Los cuatro intervalos que se usan de verdad; el resto entra por «Otro». */
export const REFRESH_PRESETS = [
    { seconds: 30, label: '30 s' },
    { seconds: 120, label: '2 min' },
    { seconds: 300, label: '5 min' },
    { seconds: 900, label: '15 min' },
];

export function formatRefresh(seconds: number): string {
    const value = Number(seconds || 0);

    if (value < 60) return `${value} s`;
    if (value % 3600 === 0) return `${value / 3600} h`;

    return `${Math.round(value / 60)} min`;
}

/**
 * De dónde sale el dato, en una línea.
 *
 * El servidor calcula la misma frase para el listado (donde no hay catálogo de tablas
 * cargado); aquí se recalcula en vivo mientras se edita el formulario, que es cuando hace
 * falta ver el efecto de cada cambio sin guardar.
 */
export function describeQuery(
    mode: QueryMode,
    definition: QueryDefinition,
    rawSql: string,
    tables: TableMeta[],
): string {
    if (mode === 'sql') {
        const sql = rawSql.replace(/\s+/g, ' ').trim();
        if (sql === '') return 'SQL sin definir';

        const match = /\bfrom\s+`?([a-z0-9_]+)`?/i.exec(sql);

        return match ? `SELECT … FROM ${match[1]}` : sql.slice(0, 70);
    }

    const table = definition.table ?? '';
    if (table === '') return 'Consulta sin definir';

    const meta = tables.find((t) => t.key === table);
    const parts: string[] = [table];

    if (definition.metric?.column && definition.metric?.aggregation) {
        parts.push(`${definition.metric.aggregation.toUpperCase()}(${definition.metric.column})`);
    }

    if ((definition.columns ?? []).length > 0) {
        const count = (definition.columns ?? []).length;
        parts.push(`${count} ${count === 1 ? 'columna' : 'columnas'}`);
    }

    (definition.scopes ?? []).forEach((scope) => {
        parts.push(meta?.scopes?.find((s) => s.key === scope)?.label ?? scope);
    });

    (definition.filters ?? []).slice(0, 2).forEach((filter) => {
        const value = filter.value_type === 'variable' ? `:${filter.value}` : filter.value;
        parts.push(`${filter.column} ${filter.operator} ${value}`.trim());
    });

    return parts.join(' · ');
}

export interface Assignment {
    company: string;
    roles_label: string;
}

/**
 * Las pastillas de «Quién lo ve»: como mucho `max` empresas y un «+N» con el resto.
 * Enumerar seis empresas en una celda de 210 px no dice más que decir cuántas faltan.
 */
export function assignmentSummary(
    assignments: Assignment[],
    max = 2,
): { visible: Assignment[]; extra: number } {
    return {
        visible: assignments.slice(0, max),
        extra: Math.max(0, assignments.length - max),
    };
}

/**
 * Catálogo de iconos del KPI.
 *
 * Son nombres de **Heroicons** a propósito: `chart_config.icon` guarda ese nombre y el
 * Dashboard lo resuelve con `HeroIcons[nombre]` en `DynamicChart`, que esta reforma no
 * toca. Migrarlos a Phosphor obligaría a cambiar el pintado del dashboard y a convertir
 * los widgets ya guardados, así que el selector sigue guardando el nombre Heroicon —pero
 * renderiza el icono, nunca su nombre en inglés—. Es la única fuente de Heroicons que
 * queda en el módulo.
 */
export const KPI_ICON_OPTIONS = [
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

/** Nombre legible del icono, para el buscador del modal y el `aria-label`. */
export function iconLabel(name: string): string {
    return name
        .replace(/Icon$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * Paleta del KPI. Los valores son los colores reales que pinta `StatCard` en el dashboard:
 * una muestra de color tiene que enseñar el color que se va a ver, no una variable del
 * tema del módulo. Vive en `lib/` justamente para no meter hex crudo en la piel `emp-*`.
 */
export const KPI_COLOR_OPTIONS: { value: string; label: string; swatch: string }[] = [
    { value: 'indigo', label: 'Índigo', swatch: '#4f46e5' },
    { value: 'emerald', label: 'Verde', swatch: '#10b981' },
    { value: 'amber', label: 'Ámbar', swatch: '#f59e0b' },
    { value: 'rose', label: 'Rosa', swatch: '#f43f5e' },
    { value: 'sky', label: 'Celeste', swatch: '#0ea5e9' },
];

/** Palabras clave que el panel de SQL generado resalta. */
export const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AND', 'OR',
    'IS NULL', 'IS NOT NULL', 'AS', 'ASC', 'DESC', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX',
    'DATE', 'DATE_FORMAT', 'DATE_SUB', 'INTERVAL', 'WEEKDAY', 'NOT', 'IN', 'EXISTS',
];
