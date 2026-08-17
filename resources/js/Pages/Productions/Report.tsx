import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StatCard } from '@/Components/UI/StatCard';
import { Tabs } from '@/Components/UI/Tabs';
import AppLayout from '@/Layouts/AppLayout';
import { Pagination } from '@/Components/UI/Pagination';
import { useIsMobile } from '@/hooks/useIsMobile';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PaginatedResponse } from '@/types';

interface Summary {
    total_quantity: number;
    total_value: number;
    total_records: number;
    total_employees: number;
}

interface AggregateRow {
    employee_id?: number;
    reference_id?: number;
    operation_id?: number;
    total_quantity: number;
    total_value: number;
    records?: number;
    employee?: { first_name: string; last_name: string };
    reference?: { code: string; name: string };
    operation?: { name: string };
}

interface DailyRow {
    date: string;
    label: string;
    total_quantity: number;
    total_value: number;
}

/**
 * Este componente lo renderizan DOS rutas con formatos distintos:
 *  - `productions.report` (ProductionController@report) envia colecciones planas.
 *  - `reports.production` (ReportController@production) las envia paginadas.
 * Por eso cada bloque se acepta en ambas formas y se normaliza antes de usarlo.
 */
type AggregateBlock = AggregateRow[] | PaginatedResponse<AggregateRow>;

interface Props {
    filters: { start: string; end: string };
    summary: Summary;
    byEmployee: AggregateBlock;
    byReference: AggregateBlock;
    byOperation: AggregateBlock;
    dailySeries: DailyRow[];
}

/** Devuelve las filas y, si el bloque venia paginado, el propio paginador. */
function normalizeBlock(block: AggregateBlock | undefined): {
    rows: AggregateRow[];
    paginated: PaginatedResponse<AggregateRow> | null;
} {
    if (Array.isArray(block)) {
        return { rows: block, paginated: null };
    }
    if (block && Array.isArray(block.data)) {
        return { rows: block.data, paginated: block };
    }

    return { rows: [], paginated: null };
}

/** Fecha local en formato YYYY-MM-DD (evita el corrimiento de zona de toISOString). */
function ymd(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function shortcutRanges() {
    const today = new Date();
    const monday = new Date(today);
    // getDay(): 0 = domingo; se retrocede hasta el lunes de la semana en curso.
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const first = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
        today: { start: ymd(today), end: ymd(today) },
        week: { start: ymd(monday), end: ymd(today) },
        month: { start: ymd(first), end: ymd(today) },
    };
}

/** "2026-08-12" -> "mié" */
function weekdayShort(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
}

export default function ProductionReport({ filters, summary, byEmployee, byReference, byOperation, dailySeries }: Props) {
    const isMobile = useIsMobile();
    const [start, setStart] = useState(filters.start);
    const [end, setEnd] = useState(filters.end);
    const [rangeOpen, setRangeOpen] = useState(false);
    const [tab, setTab] = useState<'employee' | 'reference' | 'operation'>('employee');

    const apply = (nextStart = start, nextEnd = end) => {
        router.get(route('productions.report'), { start: nextStart, end: nextEnd }, { preserveState: true, replace: true });
    };

    const ranges = shortcutRanges();
    const activeShortcut =
        filters.start === ranges.today.start && filters.end === ranges.today.end
            ? 'today'
            : filters.start === ranges.week.start && filters.end === ranges.week.end
              ? 'week'
              : filters.start === ranges.month.start && filters.end === ranges.month.end
                ? 'month'
                : 'custom';

    const applyShortcut = (key: 'today' | 'week' | 'month') => {
        const r = ranges[key];
        setStart(r.start);
        setEnd(r.end);
        apply(r.start, r.end);
    };

    const chipClass = (active: boolean) =>
        `flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors ${
            active
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
        }`;

    const daily = dailySeries ?? [];
    const maxDaily = daily.reduce((m, r) => Math.max(m, Number(r.total_value ?? 0)), 0);
    const mobileSeries = daily.map((r) => ({ ...r, shortLabel: weekdayShort(r.date) }));

    const blocks = {
        employee: normalizeBlock(byEmployee),
        reference: normalizeBlock(byReference),
        operation: normalizeBlock(byOperation),
    } as const;

    const rowName = (row: AggregateRow, key: keyof typeof blocks): string => {
        if (key === 'employee') return `${row.employee?.first_name ?? ''} ${row.employee?.last_name ?? ''}`.trim() || '—';
        if (key === 'reference') return `${row.reference?.code ?? ''} ${row.reference?.name ?? ''}`.trim() || '—';
        return row.operation?.name ?? '—';
    };

    const rowKey = (row: AggregateRow, key: keyof typeof blocks): string =>
        `${key}-${row.employee_id ?? row.reference_id ?? row.operation_id ?? Math.random()}`;

    /** Ranking movil: nombre, valor y barra de participacion contra el mayor del bloque. */
    const rankingList = (key: keyof typeof blocks) => {
        const { rows: items, paginated } = blocks[key];
        const max = items.reduce((m, r) => Math.max(m, Number(r.total_value ?? 0)), 0);

        return (
            <div>
                {items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">Sin datos</p>
                ) : (
                    <div className="space-y-3 pt-3">
                        {items.map((row) => {
                            const pct = max > 0 ? Math.max(2, Math.round((Number(row.total_value ?? 0) / max) * 100)) : 0;
                            return (
                                <div key={rowKey(row, key)}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                                            {rowName(row, key)}
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                            {formatCurrency(row.total_value)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="h-1.25 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                                            {formatNumber(row.total_quantity)} und
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {paginated ? (
                    <Pagination
                        links={paginated.links}
                        from={paginated.from}
                        to={paginated.to}
                        total={paginated.total}
                    />
                ) : null}
            </div>
        );
    };

    /** Tabla de agregados usada en escritorio (sin cambios respecto al diseno anterior). */
    const aggregateTable = (key: keyof typeof blocks, header: string) => {
        const { rows: items, paginated } = blocks[key];
        return (
            <>
                <table className="responsive-table mt-4 w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700">
                        <tr className="text-left text-xs uppercase text-slate-500">
                            <th className="py-2">{header}</th>
                            <th className="py-2 text-right">Cantidad</th>
                            <th className="py-2 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-6 text-center text-slate-400">
                                    Sin datos
                                </td>
                            </tr>
                        ) : (
                            items.map((row) => (
                                <tr key={rowKey(row, key)}>
                                    <td className="py-2" data-label={header}>
                                        {rowName(row, key)}
                                    </td>
                                    <td className="py-2 text-right" data-label="Cantidad">
                                        {formatNumber(row.total_quantity)}
                                    </td>
                                    <td className="py-2 text-right font-medium" data-label="Valor">
                                        {formatCurrency(row.total_value)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {paginated ? (
                    <Pagination
                        links={paginated.links}
                        from={paginated.from}
                        to={paginated.to}
                        total={paginated.total}
                    />
                ) : null}
            </>
        );
    };

    return (
        <AppLayout title="Reporte de Produccion">
            <Head title="Reporte de Produccion" />
            <div className="space-y-6">
                <PageHeader title="Reporte de Produccion" description="Resumen de produccion en el rango seleccionado." />

                {/* Movil: atajos de rango; escritorio conserva los dos campos de fecha. */}
                <div className="flex flex-wrap gap-2 lg:hidden">
                    <button type="button" className={chipClass(activeShortcut === 'today')} onClick={() => applyShortcut('today')}>
                        Hoy
                    </button>
                    <button type="button" className={chipClass(activeShortcut === 'week')} onClick={() => applyShortcut('week')}>
                        Semana
                    </button>
                    <button type="button" className={chipClass(activeShortcut === 'month')} onClick={() => applyShortcut('month')}>
                        Mes
                    </button>
                    <button type="button" className={chipClass(activeShortcut === 'custom')} onClick={() => setRangeOpen(true)}>
                        Rango
                    </button>
                </div>

                <Card className="hidden lg:block">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Input label="Desde" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                        <Input label="Hasta" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                        <div className="flex items-end">
                            <Button onClick={() => apply()}>Aplicar</Button>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <StatCard title="Valor producido" value={formatCurrency(summary.total_value)} color="indigo" />
                    <StatCard title="Unidades" value={formatNumber(summary.total_quantity)} color="emerald" />
                    <StatCard title="Empleados" value={formatNumber(summary.total_employees)} color="amber" />
                    <StatCard title="Registros" value={formatNumber(summary.total_records)} color="sky" />
                </div>

                <Card>
                    <CardHeader title="Produccion diaria" />
                    <div className="mt-4 h-32 lg:h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={isMobile ? mobileSeries : daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                {!isMobile ? <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> : null}
                                <XAxis
                                    dataKey={isMobile ? 'shortLabel' : 'label'}
                                    stroke="#94a3b8"
                                    tick={{ fontSize: isMobile ? 10 : 11 }}
                                    interval="preserveStartEnd"
                                    tickLine={false}
                                    axisLine={!isMobile}
                                />
                                {!isMobile ? <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} /> : null}
                                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                <Bar dataKey="total_value" radius={[4, 4, 0, 0]}>
                                    {(isMobile ? mobileSeries : daily).map((row, i) => (
                                        <Cell
                                            key={`d-${row.date}-${i}`}
                                            // El dia mas alto se resalta; el resto queda en un indigo suave.
                                            fill={Number(row.total_value ?? 0) >= maxDaily && maxDaily > 0 ? '#4f46e5' : '#c7d2fe'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Movil: pestanas; solo se renderiza el bloque activo, cada uno con su paginacion. */}
                <Card className="lg:hidden">
                    <Tabs
                        tabs={[
                            { key: 'employee', label: 'Empleado' },
                            { key: 'reference', label: 'Referencia' },
                            { key: 'operation', label: 'Operacion' },
                        ]}
                        active={tab}
                        onChange={(k) => setTab(k as typeof tab)}
                    />
                    {tab === 'employee' ? rankingList('employee') : null}
                    {tab === 'reference' ? rankingList('reference') : null}
                    {tab === 'operation' ? rankingList('operation') : null}
                </Card>

                <div className="hidden grid-cols-1 gap-6 lg:grid lg:grid-cols-2">
                    <Card>
                        <CardHeader title="Por empleado" />
                        {aggregateTable('employee', 'Empleado')}
                    </Card>

                    <Card>
                        <CardHeader title="Por referencia" />
                        {aggregateTable('reference', 'Referencia')}
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader title="Por operacion" />
                        {aggregateTable('operation', 'Operacion')}
                    </Card>
                </div>
            </div>

            <Modal
                open={rangeOpen}
                onClose={() => setRangeOpen(false)}
                title="Rango de fechas"
                footer={
                    <Button
                        fullWidth
                        className="min-h-11"
                        onClick={() => {
                            apply();
                            setRangeOpen(false);
                        }}
                    >
                        Aplicar
                    </Button>
                }
            >
                <div className="space-y-4">
                    <Input label="Desde" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                    <Input label="Hasta" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
            </Modal>
        </AppLayout>
    );
}
