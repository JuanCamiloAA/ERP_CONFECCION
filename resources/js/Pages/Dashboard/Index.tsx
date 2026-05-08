import { Head, Link, usePage } from '@inertiajs/react';
import {
    BanknotesIcon,
    BuildingOfficeIcon,
    ClipboardDocumentListIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    TagIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader } from '@/Components/UI/Card';
import { StatCard } from '@/Components/UI/StatCard';
import { EmptyState } from '@/Components/UI/EmptyState';
import { Badge } from '@/Components/UI/Badge';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface DashboardStats {
    is_personal: boolean;
    employees_active: number | null;
    references_active: number | null;
    production_month: number;
    production_month_quantity: number;
    production_month_records: number;
    production_pending_value: number;
    production_pending_quantity: number;
    payrolls_pending: number;
    advances_pending: number;
    week_series: Array<{ date: string; label: string; total_quantity: number; total_value: number }>;
    top_employees: Array<{ employee_id: number; name: string; total_quantity: number; total_value: number }>;
    top_references: Array<{ reference_id: number; name: string; total_quantity: number; total_value: number }>;
        latest_productions: Array<{
        id: number;
        date: string;
        quantity: number;
        total_value: number;
        status?: 'pendiente' | 'confirmado';
        employee?: { first_name: string; last_name: string };
        reference?: { code: string; name: string };
        operation?: { name: string };
    }>;
    pending_payrolls: Array<{
        id: number;
        name: string;
        period_start: string;
        period_end: string;
        status: string;
        total_amount: number;
    }>;
}

interface Props {
    stats: DashboardStats | null;
    requireCompany: boolean;
}

const statusColors: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
    borrador: 'neutral',
    calculado: 'info',
    aprobado: 'warning',
    pagado: 'success',
};

export default function Dashboard({ stats, requireCompany }: Props) {
    const page = usePage<App.PageProps>();
    const canPayrollsIndex = page.props.auth.user?.permissions?.includes('payrolls.index.view');
    const canPayrollShow = page.props.auth.user?.permissions?.includes('payrolls.show.view');

    if (requireCompany || !stats) {
        return (
            <AppLayout title="Dashboard">
                <Head title="Dashboard" />
                <EmptyState
                    icon={<BuildingOfficeIcon className="h-12 w-12" />}
                    title="Selecciona una empresa"
                    description="Como super administrador, debes elegir una empresa activa desde el modulo de empresas para ver estadisticas."
                />
            </AppLayout>
        );
    }

    const personal = stats.is_personal;
    const secondaryChartData = personal ? stats.top_references : stats.top_employees;

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {personal ? 'Tu avance' : 'Bienvenido al panel'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {personal
                            ? 'Resumen de tu produccion y nominas en las que participas.'
                            : 'Resumen general de actividad de tu taller.'}
                    </p>
                </div>

                {personal ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard
                            title="Tu produccion del mes"
                            value={formatCurrency(stats.production_month)}
                            subtitle={`${formatNumber(stats.production_month_quantity)} unidades confirmadas`}
                            icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                            color="emerald"
                        />
                        <StatCard
                            title="Produccion pendiente"
                            value={formatCurrency(stats.production_pending_value)}
                            subtitle={`${formatNumber(stats.production_pending_quantity)} unidades sin confirmar`}
                            icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                            color="sky"
                        />
                        <StatCard
                            title="Registros del mes"
                            value={formatNumber(stats.production_month_records)}
                            subtitle="Movimientos confirmados"
                            icon={<DocumentTextIcon className="h-6 w-6" />}
                            color="indigo"
                        />
                        <StatCard
                            title="Tus anticipos pendientes"
                            value={formatCurrency(stats.advances_pending)}
                            icon={<CurrencyDollarIcon className="h-6 w-6" />}
                            color="rose"
                        />
                        <StatCard
                            title="Nominas por pagar (te incluyen)"
                            value={formatNumber(stats.payrolls_pending)}
                            icon={<BanknotesIcon className="h-6 w-6" />}
                            color="amber"
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Empleados activos"
                            value={formatNumber(stats.employees_active ?? 0)}
                            icon={<UsersIcon className="h-6 w-6" />}
                            color="indigo"
                        />
                        <StatCard
                            title="Produccion del mes"
                            value={formatCurrency(stats.production_month)}
                            subtitle={`${formatNumber(stats.production_month_quantity)} unidades registradas (confirmadas y pendientes)`}
                            icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
                            color="emerald"
                        />
                        <StatCard
                            title="Nominas pendientes"
                            value={formatNumber(stats.payrolls_pending)}
                            icon={<BanknotesIcon className="h-6 w-6" />}
                            color="amber"
                        />
                        <StatCard
                            title="Anticipos por descontar"
                            value={formatCurrency(stats.advances_pending)}
                            icon={<CurrencyDollarIcon className="h-6 w-6" />}
                            color="rose"
                        />
                    </div>
                )}

                {!personal && stats.references_active != null && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Referencias activas"
                            value={formatNumber(stats.references_active)}
                            icon={<TagIcon className="h-6 w-6" />}
                            color="sky"
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader
                            title={personal ? 'Tu produccion ultimos 7 dias' : 'Produccion ultimos 7 dias'}
                            description={
                                personal
                                    ? 'Valor confirmado por dia (solo tus registros aprobados)'
                                    : 'Valor total por dia (registros confirmados y pendientes de confirmar)'
                            }
                        />
                        <div className="mt-4 h-72 min-h-[18rem] w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.week_series}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => formatCurrency(v).replace('$', '$')} />
                                    <Tooltip
                                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                                        labelStyle={{ color: '#0f172a' }}
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                    />
                                    <Line type="monotone" dataKey="total_value" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} name="Valor producido" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card>
                        <CardHeader
                            title={personal ? 'Top referencias (tu mes)' : 'Top 5 empleados'}
                            description={personal ? 'Por valor producido' : 'Mes en curso'}
                        />
                        <div className="mt-4 h-72 min-h-[18rem] w-full min-w-0">
                            {secondaryChartData.length === 0 ? (
                                <p className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos en el periodo.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={secondaryChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" hide />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                        <Bar dataKey="total_value" fill="#10b981" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader
                            title={personal ? 'Tus ultimas producciones' : 'Ultimas producciones registradas'}
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
                                        {!personal && <th className="py-2 text-left font-semibold">Empleado</th>}
                                        <th className="py-2 text-left font-semibold">Referencia</th>
                                        <th className="py-2 text-right font-semibold">Cantidad</th>
                                        <th className="py-2 text-right font-semibold">Valor</th>
                                        <th className="py-2 text-center font-semibold">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {stats.latest_productions.length === 0 ? (
                                        <tr>
                                            <td colSpan={personal ? 5 : 6} className="py-6 text-center text-slate-400">
                                                Aun no hay registros
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.latest_productions.map((p) => (
                                            <tr key={p.id} className="text-slate-700 dark:text-slate-300">
                                                <td className="py-2">{formatDate(p.date)}</td>
                                                {!personal && (
                                                    <td className="py-2">{p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : '-'}</td>
                                                )}
                                                <td className="py-2">
                                                    {p.reference?.code} {p.operation && `· ${p.operation.name}`}
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

                    <Card>
                        <CardHeader
                            title={personal ? 'Nominas que te incluyen' : 'Nominas pendientes'}
                            action={
                                canPayrollsIndex ? (
                                    <Link href={route('payrolls.index')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                        Ver todo →
                                    </Link>
                                ) : undefined
                            }
                        />
                        <ul className="mt-4 space-y-3">
                            {stats.pending_payrolls.length === 0 ? (
                                <li className="text-sm text-slate-400">
                                    {personal ? 'No hay nominas pendientes que te incluyan.' : 'No hay nominas pendientes'}
                                </li>
                            ) : (
                                stats.pending_payrolls.map((p) => (
                                    <li key={p.id}>
                                        {canPayrollShow ? (
                                            <Link
                                                href={route('payrolls.show', p.id)}
                                                className="block rounded-lg border border-slate-200 p-3 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                                                    <Badge variant={statusColors[p.status] ?? 'neutral'}>{p.status}</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {formatDate(p.period_start)} - {formatDate(p.period_end)}
                                                </p>
                                                <p className="mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(p.total_amount)}
                                                </p>
                                            </Link>
                                        ) : (
                                            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                                                    <Badge variant={statusColors[p.status] ?? 'neutral'}>{p.status}</Badge>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {formatDate(p.period_start)} - {formatDate(p.period_end)}
                                                </p>
                                            </div>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
