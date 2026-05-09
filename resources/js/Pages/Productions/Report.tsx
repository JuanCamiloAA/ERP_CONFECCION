import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StatCard } from '@/Components/UI/StatCard';
import AppLayout from '@/Layouts/AppLayout';
import { Pagination } from '@/Components/UI/Pagination';
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

interface Props {
    filters: { start: string; end: string };
    summary: Summary;
    byEmployee: PaginatedResponse<AggregateRow>;
    byReference: PaginatedResponse<AggregateRow>;
    byOperation: PaginatedResponse<AggregateRow>;
    dailySeries: DailyRow[];
}

export default function ProductionReport({ filters, summary, byEmployee, byReference, byOperation, dailySeries }: Props) {
    const [start, setStart] = useState(filters.start);
    const [end, setEnd] = useState(filters.end);

    const apply = () => {
        router.get(route('productions.report'), { start, end }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title="Reporte de Produccion">
            <Head title="Reporte de Produccion" />
            <div className="space-y-6">
                <PageHeader title="Reporte de Produccion" description="Resumen de produccion en el rango seleccionado." />

                <Card>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Input label="Desde" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                        <Input label="Hasta" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                        <div className="flex items-end">
                            <Button onClick={apply}>Aplicar</Button>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Valor producido" value={formatCurrency(summary.total_value)} color="indigo" />
                    <StatCard title="Unidades" value={formatNumber(summary.total_quantity)} color="emerald" />
                    <StatCard title="Empleados" value={formatNumber(summary.total_employees)} color="amber" />
                    <StatCard title="Registros" value={formatNumber(summary.total_records)} color="sky" />
                </div>

                <Card>
                    <CardHeader title="Produccion diaria" />
                    <div className="mt-4 h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailySeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                <Bar dataKey="total_value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader title="Por empleado" />
                        <table className="mt-4 w-full text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-700">
                                <tr className="text-left text-xs uppercase text-slate-500">
                                    <th className="py-2">Empleado</th>
                                    <th className="py-2 text-right">Cantidad</th>
                                    <th className="py-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {byEmployee.total === 0 ? (
                                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sin datos</td></tr>
                                ) : (
                                    byEmployee.data.map((row) => (
                                        <tr key={`emp-${row.employee_id}`}>
                                            <td className="py-2">
                                                {row.employee?.first_name} {row.employee?.last_name}
                                            </td>
                                            <td className="py-2 text-right">{formatNumber(row.total_quantity)}</td>
                                            <td className="py-2 text-right font-medium">{formatCurrency(row.total_value)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <Pagination links={byEmployee.links} from={byEmployee.from} to={byEmployee.to} total={byEmployee.total} />
                    </Card>

                    <Card>
                        <CardHeader title="Por referencia" />
                        <table className="mt-4 w-full text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-700">
                                <tr className="text-left text-xs uppercase text-slate-500">
                                    <th className="py-2">Referencia</th>
                                    <th className="py-2 text-right">Cantidad</th>
                                    <th className="py-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {byReference.total === 0 ? (
                                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sin datos</td></tr>
                                ) : (
                                    byReference.data.map((row) => (
                                        <tr key={`ref-${row.reference_id}`}>
                                            <td className="py-2">
                                                {row.reference?.code} - {row.reference?.name}
                                            </td>
                                            <td className="py-2 text-right">{formatNumber(row.total_quantity)}</td>
                                            <td className="py-2 text-right font-medium">{formatCurrency(row.total_value)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            links={byReference.links}
                            from={byReference.from}
                            to={byReference.to}
                            total={byReference.total}
                        />
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader title="Por operacion" />
                        <table className="mt-4 w-full text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-700">
                                <tr className="text-left text-xs uppercase text-slate-500">
                                    <th className="py-2">Operacion</th>
                                    <th className="py-2 text-right">Cantidad</th>
                                    <th className="py-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {byOperation.total === 0 ? (
                                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Sin datos</td></tr>
                                ) : (
                                    byOperation.data.map((row) => (
                                        <tr key={`op-${row.operation_id}`}>
                                            <td className="py-2">{row.operation?.name}</td>
                                            <td className="py-2 text-right">{formatNumber(row.total_quantity)}</td>
                                            <td className="py-2 text-right font-medium">{formatCurrency(row.total_value)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            links={byOperation.links}
                            from={byOperation.from}
                            to={byOperation.to}
                            total={byOperation.total}
                        />
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
