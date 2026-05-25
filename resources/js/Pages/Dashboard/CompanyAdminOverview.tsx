import { Link, router, usePage } from '@inertiajs/react';
import { BanknotesIcon, ClipboardDocumentListIcon, ClipboardDocumentIcon, CurrencyDollarIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { StatCard } from '@/Components/UI/StatCard';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { CompanyAdminStats } from './dashboard-types';

const statusColors: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
    borrador: 'neutral',
    calculado: 'info',
    aprobado: 'warning',
    pagado: 'success',
};

const periodChoices = [
    { key: 7, label: '7 días' },
    { key: 30, label: '30 días' },
    { key: 90, label: '90 días' },
] as const;

interface Props {
    stats: CompanyAdminStats;
}

export default function CompanyAdminOverview({ stats }: Props) {
    const page = usePage<App.PageProps>();
    const canPayrollShow = Boolean(page.props.auth.user?.permissions?.includes('payrolls.show.view'));

    const productivityData = stats.productividad_por_empleado.map((row) => ({
        ...row,
        displayName: row.short_name ?? row.name,
    }));

    const setPeriod = (days: number) => {
        router.get(route('dashboard'), { productivity_days: days }, { preserveScroll: true });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Dashboard de empresa
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Producido pendiente de liquidación como pagada, nóminas en curso y productividad reciente por empleado.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    title="Producido pendiente de pago"
                    value={formatCurrency(stats.producido_pendiente_pago)}
                    subtitle="Por operaciones, sin período cerrado pagado"
                    icon={<CurrencyDollarIcon className="h-6 w-6" />}
                    color="emerald"
                />
                <StatCard
                    title="Nóminas en «calculado»"
                    value={formatNumber(stats.nomina_calculado_count)}
                    icon={<ClipboardDocumentIcon className="h-6 w-6" />}
                    color="sky"
                />
                <StatCard
                    title="Nóminas en «aprobado»"
                    value={formatNumber(stats.nomina_aprobado_count)}
                    icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                    color="amber"
                />
                <StatCard
                    title="Nóminas sin pagar (pipeline)"
                    value={formatNumber(stats.nomina_sin_pagar_count)}
                    subtitle="Borrador → aprobado"
                    icon={<BanknotesIcon className="h-6 w-6" />}
                    color="indigo"
                />
                <StatCard
                    title="Empleados activos"
                    value={formatNumber(stats.empleados_activos_count)}
                    icon={<UsersIcon className="h-6 w-6" />}
                    color="rose"
                />
            </div>

            <Card>
                <CardHeader
                    title="Productividad por empleado"
                    description={`Suma de unidades producidas últimos ${stats.productivity_days} días`}
                    action={
                        <div className="flex flex-wrap justify-end gap-1">
                            {periodChoices.map(({ key, label }) => (
                                <Button
                                    key={key}
                                    type="button"
                                    variant={stats.productivity_days === key ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => setPeriod(key)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    }
                />
                <div className="mt-4 h-80 min-h-[20rem] w-full min-w-0">
                    {productivityData.length === 0 ? (
                        <p className="flex h-full items-center justify-center text-sm text-slate-400">
                            Sin producción en el período seleccionado.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productivityData} layout="vertical" margin={{ left: 8, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis type="category" dataKey="displayName" width={120} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length || !payload[0]?.payload) {
                                            return null;
                                        }
                                        const row = payload[0].payload as (typeof productivityData)[0];
                                        return (
                                            <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50">
                                                <div className="font-semibold">{row.displayName}</div>
                                                <div>Unidades: {formatNumber(Number(row.total_quantity ?? 0))}</div>
                                                <div>Valor: {formatCurrency(Number(row.total_value ?? 0))}</div>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar dataKey="total_quantity" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Últimas producciones"
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
                                    <th className="py-2 text-left font-semibold">Empleado</th>
                                    <th className="py-2 text-left font-semibold">Referencia · operación</th>
                                    <th className="py-2 text-right font-semibold">Cantidad</th>
                                    <th className="py-2 text-right font-semibold">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {stats.latest_productions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-slate-400">
                                            Aún no hay registros recientes.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.latest_productions.map((p) => (
                                        <tr key={p.id} className="text-slate-700 dark:text-slate-300">
                                            <td className="py-2">{formatDate(p.date)}</td>
                                            <td className="py-2">
                                                {p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : '—'}
                                            </td>
                                            <td className="py-2">
                                                {p.reference?.code ?? ''}{p.reference?.code && ' '}{p.reference?.name}
                                                {p.operation?.name && ` · ${p.operation.name}`}
                                            </td>
                                            <td className="py-2 text-right">{formatNumber(p.quantity)}</td>
                                            <td className="py-2 text-right font-medium">{formatCurrency(p.total_value)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Últimas nóminas"
                        description="Todos los estados recientes por periodo."
                        action={
                            <Link href={route('payrolls.index')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                Ver todo →
                            </Link>
                        }
                    />
                    <ul className="mt-4 space-y-2">
                        {stats.recent_payrolls.length === 0 ? (
                            <li className="text-sm text-slate-400">No hay nominas registradas.</li>
                        ) : (
                            stats.recent_payrolls.map((p) => (
                                <li key={p.id}>
                                    {canPayrollShow ? (
                                        <Link
                                            href={route('payrolls.show', p.id)}
                                            className="block rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold">{p.name}</p>
                                                <Badge variant={statusColors[p.status] ?? 'neutral'}>{p.status}</Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(p.period_start)} – {formatDate(p.period_end)}
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                                Total nómina: {formatCurrency(p.total_amount)}
                                            </p>
                                        </Link>
                                    ) : (
                                        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold">{p.name}</p>
                                                <Badge variant={statusColors[p.status] ?? 'neutral'}>{p.status}</Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(p.period_start)} – {formatDate(p.period_end)}
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                Total nómina: {formatCurrency(p.total_amount)}
                                            </p>
                                        </div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </Card>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
                <strong>Producido pendiente de pago</strong>: suma de montos confirmados por operaciones cuya fecha sigue abierta —
                no existe todavía un periodo marcado como <em>pagado</em> que la cubra.
            </p>
        </div>
    );
}
