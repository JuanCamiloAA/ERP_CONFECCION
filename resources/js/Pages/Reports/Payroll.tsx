import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { StatCard } from '@/Components/UI/StatCard';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Payroll } from '@/types';

interface Summary {
    total_payrolls: number;
    total_amount: number;
    total_paid: number;
    total_pending: number;
}

interface Props {
    filters: { year: number };
    summary: Summary;
    payrolls: Payroll[];
}

const statusVariant: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
    borrador: 'neutral',
    calculado: 'info',
    aprobado: 'warning',
    pagado: 'success',
};

export default function ReportPayroll({ filters, summary, payrolls }: Props) {
    const [year, setYear] = useState(filters.year);
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    const apply = () => {
        router.get(route('reports.payroll'), { year }, { preserveState: true, replace: true });
    };

    const chartData = payrolls.map((p) => ({
        name: p.name,
        total: Number(p.total_amount),
    }));

    return (
        <AppLayout title="Reporte de Nomina">
            <Head title="Reporte de Nomina" />
            <div className="space-y-6">
                <PageHeader title="Reporte de Nomina" description={`Resumen anual de nominas - ${year}`} />

                <div className="flex flex-wrap gap-3">
                    <Select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        className="sm:max-w-[140px]"
                    />
                    <Button onClick={apply}>Aplicar</Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <StatCard title="Total nominas" value={summary.total_payrolls} color="indigo" />
                    <StatCard title="Monto total" value={formatCurrency(summary.total_amount)} color="sky" />
                    <StatCard title="Pagado" value={formatCurrency(summary.total_paid)} color="emerald" />
                    <StatCard title="Pendiente" value={formatCurrency(summary.total_pending)} color="amber" />
                </div>

                <Card>
                    <CardHeader title="Comparativa por nomina" />
                    <div className="mt-4 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <CardHeader title="Detalle de nominas" />
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-700">
                                <tr className="text-left text-xs uppercase text-slate-500">
                                    <th className="py-2">Nomina</th>
                                    <th className="py-2">Periodo</th>
                                    <th className="py-2">Estado</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {payrolls.length === 0 ? (
                                    <tr><td colSpan={4} className="py-6 text-center text-slate-400">No hay nominas en este ano</td></tr>
                                ) : payrolls.map((p) => (
                                    <tr key={p.id}>
                                        <td className="py-2"><Link href={route('payrolls.show', p.id)} className="text-indigo-600 hover:underline dark:text-indigo-400">{p.name}</Link></td>
                                        <td className="py-2">{formatDate(p.period_start)} - {formatDate(p.period_end)}</td>
                                        <td className="py-2"><Badge variant={statusVariant[p.status]}>{p.status}</Badge></td>
                                        <td className="py-2 text-right font-medium">{formatCurrency(p.total_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
