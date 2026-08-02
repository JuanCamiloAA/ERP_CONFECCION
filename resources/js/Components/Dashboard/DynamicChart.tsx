import * as HeroIcons from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/outline';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { StatCard } from '@/Components/UI/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { WidgetType, WidgetDataPayload } from '@/Components/DashboardBuilder/dashboard-builder-types';

interface DynamicChartProps {
    type: WidgetType;
    data: WidgetDataPayload | null | undefined;
    config?: Record<string, unknown> | null;
    title: string;
}

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#eab308'];

const STAT_CARD_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky'] as const;

function formatValue(value: number, config?: Record<string, unknown> | null): string {
    if (config?.currency) {
        return formatCurrency(value);
    }
    return formatNumber(value);
}

function resolveKpiIcon(name: unknown) {
    if (typeof name !== 'string' || name === '') {
        return null;
    }
    const Cmp = (HeroIcons as unknown as Record<string, typeof SparklesIcon>)[name];
    return Cmp ?? SparklesIcon;
}

function resolveKpiColor(color: unknown): (typeof STAT_CARD_COLORS)[number] {
    return (STAT_CARD_COLORS as readonly string[]).includes(color as string)
        ? (color as (typeof STAT_CARD_COLORS)[number])
        : 'indigo';
}

export function DynamicChart({ type, data, config, title }: DynamicChartProps) {
    if (!data) {
        return <p className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos.</p>;
    }

    if (type === 'kpi') {
        const Icon = resolveKpiIcon(config?.icon);
        const subtitle = typeof config?.subtitle === 'string' && config.subtitle !== '' ? config.subtitle : undefined;
        return (
            <StatCard
                title={title}
                value={formatValue(data.value ?? 0, config)}
                subtitle={subtitle}
                color={resolveKpiColor(config?.color)}
                icon={Icon ? <Icon className="h-6 w-6" /> : undefined}
            />
        );
    }

    if (type === 'table') {
        const columns = data.columns ?? [];
        const rows = data.rows ?? [];
        return (
            <Table>
                <TableHead>
                    <TableRow>
                        {columns.map((c) => (
                            <TableHeader key={c}>{c}</TableHeader>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={Math.max(columns.length, 1)} className="px-4 py-8 text-center text-sm text-slate-400">
                                Sin resultados.
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, idx) => (
                            <TableRow key={idx}>
                                {columns.map((c) => (
                                    <TableCell key={c}>{String(row[c] ?? '')}</TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        );
    }

    const chartData = (data.labels ?? []).map((label, i) => ({
        label,
        value: (data.series ?? [])[i] ?? 0,
    }));

    if (chartData.length === 0) {
        return <p className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos en el periodo.</p>;
    }

    if (type === 'line') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip formatter={(v: number) => formatValue(Number(v), config)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'pie') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip formatter={(v: number) => formatValue(Number(v), config)} />
                    <Pie data={chartData} dataKey="value" nameKey="label" outerRadius="80%">
                        {chartData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        );
    }

    // bar (default)
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip formatter={(v: number) => formatValue(Number(v), config)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export default DynamicChart;
