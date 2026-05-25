import { Link, usePage } from '@inertiajs/react';
import { BanknotesIcon, ClipboardDocumentListIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/Components/UI/Badge';
import { Card, CardHeader } from '@/Components/UI/Card';
import { EmptyState } from '@/Components/UI/EmptyState';
import { StatCard } from '@/Components/UI/StatCard';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { EmployeeStats } from './dashboard-types';

const fixedDailySubtitle =
    'Modo salario diario/jornadas: el pago se liquida por nómina y jornadas, no por unidades pendientes aquí.';
const PAYROLL_OPS = 'operations';

interface Props {
    stats: EmployeeStats;
}

export default function EmployeeOverview({ stats }: Props) {
    const page = usePage<App.PageProps>();
    const canPayrollsIndex = Boolean(page.props.auth.user?.permissions?.includes('payrolls.index.view'));

    const isOpsMode = stats.payroll_mode === PAYROLL_OPS;

    const chartData = stats.payroll_history_pagadas.map((row, index) => ({
        ...row,
        key: `${row.period_end ?? index}`,
        chartLabel: row.period_end ? formatDate(row.period_end) : `#${index + 1}`,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tu dashboard</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Resumen de producción pendiente de pago oficial, anticipos por descontar e historial de nóminas pagadas.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                    title="Unidades pendientes por pagar"
                    value={!isOpsMode ? '—' : `${formatNumber(stats.unidades_pendientes_pagar)} unidades`}
                    subtitle={
                        !isOpsMode
                            ? fixedDailySubtitle
                            : stats.valor_estimado_pendiente_pago != null && stats.valor_estimado_pendiente_pago > 0
                              ? `Valor estimado pendiente ${formatCurrency(stats.valor_estimado_pendiente_pago)} (hasta registrar un período nominal pagado).`
                              : 'Produccion no incluida aún en un período marcado pagado.'
                    }
                    icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                    color="emerald"
                />
                <StatCard
                    title="Anticipos pendientes por descontar"
                    value={formatCurrency(stats.anticipos_total_pendiente)}
                    subtitle="Por cobrar o descontar en la siguiente nómina."
                    icon={<CurrencyDollarIcon className="h-6 w-6" />}
                    color="rose"
                />
                <StatCard
                    title="Nomina te incluye (calculado/aprobado)"
                    value={formatNumber(stats.nomina_abierta_count)}
                    subtitle={
                        canPayrollsIndex ? (
                            <Link className="text-indigo-600 hover:underline dark:text-indigo-400" href={route('payrolls.index')}>
                                Ver nóminas
                            </Link>
                        ) : undefined
                    }
                    icon={<BanknotesIcon className="h-6 w-6" />}
                    color="amber"
                />
            </div>

            {stats.anticipos_preview.length > 0 && (
                <Card>
                    <CardHeader title="Próximos anticipos pendientes (máx. 5)" />
                    <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-700/60">
                        {stats.anticipos_preview.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                                <span className="text-slate-600 dark:text-slate-400">{formatDate(a.date)}</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(a.amount)}</span>
                                <span className="w-full text-xs text-slate-500">{a.reason || 'Sin motivo'}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card>
                <CardHeader
                    title="Historial neto pagado por nómina"
                    description="Últimos periodos marcados pagados donde participaste."
                />
                <div className="mt-4 min-h-[16rem] w-full min-w-0">
                    {chartData.length === 0 ? (
                        <EmptyState
                            className="py-10"
                            title="Sin nóminas pagadas registradas"
                            description="Cuando tus liquidaciones aparezcan pagadas aquí podrás ver la tendencia mensual."
                        />
                    ) : (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="chartLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `$${Math.round(Number(v))}`} />
                                    <Tooltip
                                        formatter={(value) => [formatCurrency(Number(value ?? 0)), ' Neto '] as const}
                                        labelFormatter={(l) => `Periodo: ${String(l)}`}
                                        contentStyle={{ borderRadius: 8 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="net_payment"
                                        name=" Neto pagado "
                                        stroke="#4f46e5"
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Tus últimas producciones"
                    action={
                        <Link href={route('productions.index')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                            Ver todo →
                        </Link>
                    }
                />
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                <th className="py-2 text-left font-semibold">Fecha</th>
                                <th className="py-2 text-left font-semibold">Referencia · operación</th>
                                <th className="py-2 text-right font-semibold">Cantidad</th>
                                <th className="py-2 text-right font-semibold">Valor</th>
                                <th className="py-2 text-center font-semibold">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {stats.latest_productions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">
                                        Aún no hay registros
                                    </td>
                                </tr>
                            ) : (
                                stats.latest_productions.map((p) => (
                                    <tr key={p.id} className="text-slate-700 dark:text-slate-300">
                                        <td className="py-2">{formatDate(p.date)}</td>
                                        <td className="py-2">
                                            {p.reference?.code ?? ''}{p.reference?.code && ' '}
                                            {p.operation?.name && ` · ${p.operation.name}`}
                                        </td>
                                        <td className="py-2 text-right">{formatNumber(p.quantity)}</td>
                                        <td className="py-2 text-right font-medium">{formatCurrency(p.total_value)}</td>
                                        <td className="py-2 text-center">
                                            <Badge variant={(p.status ?? 'confirmado') === 'pendiente' ? 'warning' : 'success'}>
                                                {(p.status ?? 'confirmado') === 'pendiente' ? 'Pendiente' : 'Confirmado'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
