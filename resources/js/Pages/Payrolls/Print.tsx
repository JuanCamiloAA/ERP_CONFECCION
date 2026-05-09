import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Company, Payroll, PayrollEmployee } from '@/types';

interface Props {
    payroll: Payroll & { company?: Company; payroll_employees: PayrollEmployee[] };
}

export default function PayrollPrint({ payroll }: Props) {
    useEffect(() => {
        setTimeout(() => window.print(), 500);
    }, []);

    const rows = payroll.payroll_employees ?? [];
    const showDaily = rows.some((r) => Number(r.daily_work_subtotal ?? 0) > 0);
    const totalProduction = rows.reduce((s, r) => s + Number(r.production_total), 0);
    const totalDaily = rows.reduce((s, r) => s + Number(r.daily_work_subtotal ?? 0), 0);
    const totalAdjustments = rows.reduce((s, r) => s + Number(r.adjustments_subtotal ?? 0), 0);
    const totalGross = rows.reduce(
        (s, r) => s + Number(r.production_total) + Number(r.daily_work_subtotal ?? 0) + Number(r.adjustments_subtotal ?? 0),
        0,
    );
    const totalAdvances = rows.reduce((s, r) => s + Number(r.advances_discount), 0);
    const totalDeductions = rows.reduce((s, r) => {
        const arr = (r.deductions as Array<{ amount: number }>) ?? [];
        return s + arr.reduce((a, d) => a + Number(d.amount ?? 0), 0);
    }, 0);

    return (
        <>
            <Head title={`Imprimir ${payroll.name}`} />
            <style>{`
                @media print {
                    body { background: white; }
                    .no-print { display: none !important; }
                }
            `}</style>
            <div className="mx-auto max-w-5xl bg-white p-8 text-slate-900">
                <div className="mb-6 flex items-start justify-between border-b pb-4">
                    <div>
                        <h1 className="text-xl font-bold">{payroll.company?.name ?? 'Empresa'}</h1>
                        {payroll.company?.nit && <p className="text-sm text-slate-600">NIT: {payroll.company.nit}</p>}
                        {payroll.company?.address && <p className="text-sm text-slate-600">{payroll.company.address}</p>}
                        {payroll.company?.phone && <p className="text-sm text-slate-600">Tel: {payroll.company.phone}</p>}
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-semibold">Liquidacion de Nomina</h2>
                        <p className="text-sm">{payroll.name}</p>
                        <p className="text-xs text-slate-600">
                            Periodo: {formatDate(payroll.period_start)} - {formatDate(payroll.period_end)}
                        </p>
                    </div>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-300 bg-slate-100 text-left">
                            <th className="px-2 py-2">Empleado</th>
                            <th className="px-2 py-2">Documento</th>
                            <th className="px-2 py-2 text-right">Producido</th>
                            {showDaily ? <th className="px-2 py-2 text-right">Jornada</th> : null}
                            <th className="px-2 py-2 text-right">Ajustes</th>
                            <th className="px-2 py-2 text-right">Bruto</th>
                            <th className="px-2 py-2 text-right">Deducciones</th>
                            <th className="px-2 py-2 text-right">Anticipos</th>
                            <th className="px-2 py-2 text-right">Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const dedTotal = ((row.deductions as Array<{ amount: number }>) ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);
                            const gross =
                                Number(row.production_total) +
                                Number(row.daily_work_subtotal ?? 0) +
                                Number(row.adjustments_subtotal ?? 0);
                            return (
                                <tr key={row.id} className="border-b border-slate-200">
                                    <td className="px-2 py-2">{row.employee?.first_name} {row.employee?.last_name}</td>
                                    <td className="px-2 py-2">{row.employee?.document_number}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(row.production_total)}</td>
                                    {showDaily ? (
                                        <td className="px-2 py-2 text-right">{formatCurrency(row.daily_work_subtotal ?? 0)}</td>
                                    ) : null}
                                    <td className="px-2 py-2 text-right">{formatCurrency(row.adjustments_subtotal ?? 0)}</td>
                                    <td className="px-2 py-2 text-right font-medium">{formatCurrency(gross)}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(dedTotal)}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(row.advances_discount)}</td>
                                    <td className="px-2 py-2 text-right font-bold">{formatCurrency(row.net_payment)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-slate-400 bg-slate-50">
                            <td colSpan={2} className="px-2 py-2 text-right text-xs uppercase">Totales</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(totalProduction)}</td>
                            {showDaily ? <td className="px-2 py-2 text-right">{formatCurrency(totalDaily)}</td> : null}
                            <td className="px-2 py-2 text-right">{formatCurrency(totalAdjustments)}</td>
                            <td className="px-2 py-2 text-right font-medium">{formatCurrency(totalGross)}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(totalDeductions)}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(totalAdvances)}</td>
                            <td className="px-2 py-2 text-right font-bold">{formatCurrency(payroll.total_amount)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-12 grid grid-cols-2 gap-12 text-sm">
                    <div className="border-t border-slate-300 pt-2 text-center">
                        <p>Firma Responsable</p>
                    </div>
                    <div className="border-t border-slate-300 pt-2 text-center">
                        <p>Firma Empleado</p>
                    </div>
                </div>

                <div className="no-print mt-8 text-center">
                    <button onClick={() => window.print()} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
                        Imprimir
                    </button>
                </div>
            </div>
        </>
    );
}
