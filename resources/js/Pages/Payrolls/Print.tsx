import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Company, Payroll, PayrollEmployee, Production, WorkDaySession } from '@/types';

interface Props {
    payroll: Payroll & { company?: Company; payroll_employees: PayrollEmployee[] };
    /** "general": una fila por empleado (resumen). "detailed": una seccion por empleado con su detalle. */
    mode?: 'general' | 'detailed';
    productionsByEmployee?: Record<string, Production[]>;
    workSessionsByEmployee?: Record<string, WorkDaySession[]>;
}

function employeeName(row: PayrollEmployee): string {
    return `${row.employee?.first_name ?? ''} ${row.employee?.last_name ?? ''}`.trim() || 'Empleado';
}

function deductionsTotal(row: PayrollEmployee): number {
    return ((row.deductions as Array<{ amount: number }>) ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);
}

function rowGross(row: PayrollEmployee): number {
    return (
        Number(row.production_total) +
        Number(row.daily_work_subtotal ?? 0) +
        Number(row.legal_hourly_subtotal ?? 0) +
        Number(row.adjustments_subtotal ?? 0)
    );
}

export default function PayrollPrint({
    payroll,
    mode = 'general',
    productionsByEmployee = {},
    workSessionsByEmployee = {},
}: Props) {
    useEffect(() => {
        setTimeout(() => window.print(), 500);
    }, []);

    const rows = payroll.payroll_employees ?? [];
    const isDetailed = mode === 'detailed';
    const showDaily = rows.some((r) => Number(r.daily_work_subtotal ?? 0) > 0);
    const showLegal = rows.some((r) => Number(r.legal_hourly_subtotal ?? 0) > 0);
    const totalProduction = rows.reduce((s, r) => s + Number(r.production_total), 0);
    const totalDaily = rows.reduce((s, r) => s + Number(r.daily_work_subtotal ?? 0), 0);
    const totalLegal = rows.reduce((s, r) => s + Number(r.legal_hourly_subtotal ?? 0), 0);
    const totalAdjustments = rows.reduce((s, r) => s + Number(r.adjustments_subtotal ?? 0), 0);
    const totalGross = rows.reduce((s, r) => s + rowGross(r), 0);
    const totalAdvances = rows.reduce((s, r) => s + Number(r.advances_discount), 0);
    const totalDeductions = rows.reduce((s, r) => s + deductionsTotal(r), 0);

    const logoSrc = payroll.company?.logo ? mediaUrl(payroll.company.logo) : undefined;

    /**
     * En el informe detallado se repite al inicio de cada hoja (una hoja por empleado), por eso
     * es una funcion y no un bloque unico: cada seccion lo renderiza para su propia pagina.
     */
    const companyHeader = () => (
        <div className="mb-6 flex items-start justify-between border-b pb-4">
            <div className="flex items-center gap-3">
                {logoSrc ? (
                    <img
                        src={logoSrc}
                        alt={payroll.company?.name ?? 'Logo'}
                        className="h-14 w-14 shrink-0 rounded object-contain"
                    />
                ) : null}
                <div>
                    <h1 className="text-xl font-bold">{payroll.company?.name ?? 'Empresa'}</h1>
                    {payroll.company?.nit && <p className="text-sm text-slate-600">NIT: {payroll.company.nit}</p>}
                    {payroll.company?.address && <p className="text-sm text-slate-600">{payroll.company.address}</p>}
                    {payroll.company?.phone && <p className="text-sm text-slate-600">Tel: {payroll.company.phone}</p>}
                </div>
            </div>
            <div className="text-right">
                <h2 className="text-lg font-semibold">Liquidacion de Nomina</h2>
                <p className="text-sm">{payroll.name}</p>
                <p className="text-xs text-slate-600">
                    Periodo: {formatDate(payroll.period_start)} - {formatDate(payroll.period_end)}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {isDetailed ? 'Informe detallado por empleado' : 'Informe general'}
                </p>
            </div>
        </div>
    );

    const signatures = (
        <div className="mt-12 grid grid-cols-2 gap-12 text-sm">
            <div className="border-t border-slate-300 pt-2 text-center">
                <p>Firma Responsable</p>
            </div>
            <div className="border-t border-slate-300 pt-2 text-center">
                <p>Firma Empleado</p>
            </div>
        </div>
    );

    return (
        <>
            <Head title={`Imprimir ${payroll.name}`} />
            <style>{`
                @page { size: letter; margin: 12mm; }
                @media print {
                    body { background: white; }
                    .no-print { display: none !important; }
                    /* Cada empleado (y el resumen final) arranca en hoja nueva. */
                    .page-break { break-before: page; page-break-before: always; }
                    /* Evita que una fila quede partida entre dos hojas y repite el encabezado
                     * de la tabla cuando una tabla larga si necesita continuar en la siguiente. */
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-row-group; }
                }
            `}</style>
            <div className="mx-auto max-w-5xl bg-white p-8 text-slate-900">
                {/* En detallado el encabezado va dentro de cada seccion, para que se repita por hoja. */}
                {isDetailed ? null : companyHeader()}

                {isDetailed ? (
                    <>
                        {rows.map((row, index) => {
                            const prods = productionsByEmployee[String(row.employee_id)] ?? [];
                            const sessions = workSessionsByEmployee[String(row.employee_id)] ?? [];
                            const gross = rowGross(row);
                            const dedTotal = deductionsTotal(row);
                            const hasLegal = Number(row.legal_hourly_subtotal ?? 0) > 0;
                            const hasDaily = Number(row.daily_work_subtotal ?? 0) > 0;

                            // El margen superior es solo para la vista en pantalla: al imprimir,
                            // la seccion ya arranca en una hoja nueva por el salto de pagina.
                            return (
                                <section key={row.id} className={index > 0 ? 'page-break mt-12 print:mt-0' : ''}>
                                    {companyHeader()}
                                    <div className="mb-3 flex items-baseline justify-between border-b border-slate-300 pb-1">
                                        <h3 className="text-base font-bold">{employeeName(row)}</h3>
                                        <p className="text-xs text-slate-600">
                                            Documento: {row.employee?.document_number ?? '—'}
                                        </p>
                                    </div>

                                    {prods.length > 0 ? (
                                        <div className="mb-4">
                                            <h4 className="mb-1 text-xs font-semibold uppercase text-slate-600">
                                                Detalle de operaciones
                                            </h4>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-300 bg-slate-100 text-left">
                                                        <th className="px-2 py-1.5">Fecha</th>
                                                        <th className="px-2 py-1.5">Referencia</th>
                                                        <th className="px-2 py-1.5">Operacion</th>
                                                        <th className="px-2 py-1.5 text-right">Cantidad</th>
                                                        <th className="px-2 py-1.5 text-right">Valor</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {prods.map((p) => (
                                                        <tr key={p.id} className="border-b border-slate-200">
                                                            <td className="px-2 py-1.5">{formatDate(p.date)}</td>
                                                            <td className="px-2 py-1.5">
                                                                {p.reference ? `${p.reference.code} · ${p.reference.name}` : '—'}
                                                            </td>
                                                            <td className="px-2 py-1.5">{p.operation?.name ?? '—'}</td>
                                                            <td className="px-2 py-1.5 text-right">{formatNumber(p.quantity)}</td>
                                                            <td className="px-2 py-1.5 text-right">{formatCurrency(p.total_value)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t border-slate-400 bg-slate-50 font-semibold">
                                                        <td colSpan={3} className="px-2 py-1.5 text-right text-xs uppercase">
                                                            Total operaciones
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatNumber(prods.reduce((s, p) => s + Number(p.quantity ?? 0), 0))}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatCurrency(prods.reduce((s, p) => s + Number(p.total_value ?? 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    ) : null}

                                    {(hasDaily || hasLegal) && sessions.length > 0 ? (
                                        <div className="mb-4">
                                            <h4 className="mb-1 text-xs font-semibold uppercase text-slate-600">
                                                Jornadas registradas
                                            </h4>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-300 bg-slate-100 text-left">
                                                        <th className="px-2 py-1.5">Fecha</th>
                                                        <th className="px-2 py-1.5">Entrada</th>
                                                        <th className="px-2 py-1.5">Salida</th>
                                                        <th className="px-2 py-1.5 text-right">Minutos</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sessions.map((s) => (
                                                        <tr key={s.id} className="border-b border-slate-200">
                                                            <td className="px-2 py-1.5">{formatDate(s.work_date)}</td>
                                                            <td className="px-2 py-1.5">
                                                                {s.clock_in_at ? new Date(s.clock_in_at).toLocaleTimeString() : '—'}
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                {s.clock_out_at ? new Date(s.clock_out_at).toLocaleTimeString() : '—'}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-right">
                                                                {formatNumber(s.duration_minutes ?? 0)} min
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}

                                    {hasLegal && row.legal_hours_breakdown ? (
                                        <div className="mb-4">
                                            <h4 className="mb-1 text-xs font-semibold uppercase text-slate-600">
                                                Liquidacion por horas (legal)
                                            </h4>
                                            <table className="w-full text-xs">
                                                <tbody>
                                                    <tr className="border-b border-slate-200">
                                                        <td className="px-2 py-1.5">Salario base del periodo</td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatCurrency(row.legal_hours_breakdown.base_salary_earned)}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b border-slate-200">
                                                        <td className="px-2 py-1.5">Recargo nocturno</td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatCurrency(row.legal_hours_breakdown.night_surcharge_amount)}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b border-slate-200">
                                                        <td className="px-2 py-1.5">Recargo dominical/festivo</td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatCurrency(row.legal_hours_breakdown.sunday_holiday_surcharge_amount)}
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b border-slate-200">
                                                        <td className="px-2 py-1.5">Horas extra</td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {formatCurrency(row.legal_hours_breakdown.overtime_amount)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}

                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr className="border-b border-slate-200">
                                                <td className="px-2 py-1.5">Producido</td>
                                                <td className="px-2 py-1.5 text-right">{formatCurrency(row.production_total)}</td>
                                            </tr>
                                            {hasDaily ? (
                                                <tr className="border-b border-slate-200">
                                                    <td className="px-2 py-1.5">Jornada</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.daily_work_subtotal ?? 0)}
                                                    </td>
                                                </tr>
                                            ) : null}
                                            {hasLegal ? (
                                                <tr className="border-b border-slate-200">
                                                    <td className="px-2 py-1.5">Legal (horas)</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.legal_hourly_subtotal ?? 0)}
                                                    </td>
                                                </tr>
                                            ) : null}
                                            <tr className="border-b border-slate-200">
                                                <td className="px-2 py-1.5">Ajustes manuales</td>
                                                <td className="px-2 py-1.5 text-right">
                                                    {formatCurrency(row.adjustments_subtotal ?? 0)}
                                                </td>
                                            </tr>
                                            <tr className="border-b border-slate-300 font-semibold">
                                                <td className="px-2 py-1.5">Bruto</td>
                                                <td className="px-2 py-1.5 text-right">{formatCurrency(gross)}</td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="px-2 py-1.5">Deducciones</td>
                                                <td className="px-2 py-1.5 text-right">- {formatCurrency(dedTotal)}</td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="px-2 py-1.5">Anticipos</td>
                                                <td className="px-2 py-1.5 text-right">
                                                    - {formatCurrency(row.advances_discount)}
                                                </td>
                                            </tr>
                                            {Number(row.absence_discount_total ?? 0) > 0 ? (
                                                <tr className="border-b border-slate-200">
                                                    <td className="px-2 py-1.5">Descuento por inasistencia</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        - {formatCurrency(row.absence_discount_total ?? 0)}
                                                    </td>
                                                </tr>
                                            ) : null}
                                            <tr className="border-t-2 border-slate-400 bg-slate-50 text-sm font-bold">
                                                <td className="px-2 py-2">Neto a pagar</td>
                                                <td className="px-2 py-2 text-right">{formatCurrency(row.net_payment)}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <div className="mt-10 grid grid-cols-2 gap-12 text-xs">
                                        <div className="border-t border-slate-300 pt-2 text-center">
                                            <p>Firma Responsable</p>
                                        </div>
                                        <div className="border-t border-slate-300 pt-2 text-center">
                                            <p>{employeeName(row)}</p>
                                        </div>
                                    </div>
                                </section>
                            );
                        })}

                        {rows.length === 0 ? (
                            <p className="text-sm text-slate-600">Esta nomina no tiene empleados calculados.</p>
                        ) : (
                            <section className="page-break mt-12 print:mt-0">
                                {companyHeader()}
                                <h3 className="mb-2 text-sm font-semibold uppercase text-slate-600">Resumen general</h3>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-300 bg-slate-100 text-left">
                                            <th className="px-2 py-1.5">Empleado</th>
                                            <th className="px-2 py-1.5 text-right">Bruto</th>
                                            <th className="px-2 py-1.5 text-right">Deducciones</th>
                                            <th className="px-2 py-1.5 text-right">Anticipos</th>
                                            <th className="px-2 py-1.5 text-right">Neto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-200">
                                                <td className="px-2 py-1.5">{employeeName(row)}</td>
                                                <td className="px-2 py-1.5 text-right">{formatCurrency(rowGross(row))}</td>
                                                <td className="px-2 py-1.5 text-right">{formatCurrency(deductionsTotal(row))}</td>
                                                <td className="px-2 py-1.5 text-right">{formatCurrency(row.advances_discount)}</td>
                                                <td className="px-2 py-1.5 text-right font-bold">{formatCurrency(row.net_payment)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
                                            <td className="px-2 py-1.5 text-right text-xs uppercase">Totales</td>
                                            <td className="px-2 py-1.5 text-right">{formatCurrency(totalGross)}</td>
                                            <td className="px-2 py-1.5 text-right">{formatCurrency(totalDeductions)}</td>
                                            <td className="px-2 py-1.5 text-right">{formatCurrency(totalAdvances)}</td>
                                            <td className="px-2 py-1.5 text-right">{formatCurrency(payroll.total_amount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </section>
                        )}
                    </>
                ) : (
                    <>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-300 bg-slate-100 text-left">
                                    <th className="px-2 py-2">Empleado</th>
                                    <th className="px-2 py-2">Documento</th>
                                    <th className="px-2 py-2 text-right">Producido</th>
                                    {showDaily ? <th className="px-2 py-2 text-right">Jornada</th> : null}
                                    {showLegal ? <th className="px-2 py-2 text-right">Legal (horas)</th> : null}
                                    <th className="px-2 py-2 text-right">Ajustes</th>
                                    <th className="px-2 py-2 text-right">Bruto</th>
                                    <th className="px-2 py-2 text-right">Deducciones</th>
                                    <th className="px-2 py-2 text-right">Anticipos</th>
                                    <th className="px-2 py-2 text-right">Neto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-slate-200">
                                        <td className="px-2 py-2">{employeeName(row)}</td>
                                        <td className="px-2 py-2">{row.employee?.document_number}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(row.production_total)}</td>
                                        {showDaily ? (
                                            <td className="px-2 py-2 text-right">{formatCurrency(row.daily_work_subtotal ?? 0)}</td>
                                        ) : null}
                                        {showLegal ? (
                                            <td className="px-2 py-2 text-right">{formatCurrency(row.legal_hourly_subtotal ?? 0)}</td>
                                        ) : null}
                                        <td className="px-2 py-2 text-right">{formatCurrency(row.adjustments_subtotal ?? 0)}</td>
                                        <td className="px-2 py-2 text-right font-medium">{formatCurrency(rowGross(row))}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(deductionsTotal(row))}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(row.advances_discount)}</td>
                                        <td className="px-2 py-2 text-right font-bold">{formatCurrency(row.net_payment)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-400 bg-slate-50">
                                    <td colSpan={2} className="px-2 py-2 text-right text-xs uppercase">Totales</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(totalProduction)}</td>
                                    {showDaily ? <td className="px-2 py-2 text-right">{formatCurrency(totalDaily)}</td> : null}
                                    {showLegal ? <td className="px-2 py-2 text-right">{formatCurrency(totalLegal)}</td> : null}
                                    <td className="px-2 py-2 text-right">{formatCurrency(totalAdjustments)}</td>
                                    <td className="px-2 py-2 text-right font-medium">{formatCurrency(totalGross)}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(totalDeductions)}</td>
                                    <td className="px-2 py-2 text-right">{formatCurrency(totalAdvances)}</td>
                                    <td className="px-2 py-2 text-right font-bold">{formatCurrency(payroll.total_amount)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        {showLegal && (
                            <div className="mt-8">
                                <h3 className="mb-2 text-sm font-semibold uppercase text-slate-600">
                                    Desglose modalidad por horas (legal)
                                </h3>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-300 bg-slate-100 text-left">
                                            <th className="px-2 py-1.5">Empleado</th>
                                            <th className="px-2 py-1.5 text-right">Salario base</th>
                                            <th className="px-2 py-1.5 text-right">Recargo nocturno</th>
                                            <th className="px-2 py-1.5 text-right">Recargo dom/festivo</th>
                                            <th className="px-2 py-1.5 text-right">Horas extra</th>
                                            <th className="px-2 py-1.5 text-right">Subtotal legal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows
                                            .filter((r) => Number(r.legal_hourly_subtotal ?? 0) > 0)
                                            .map((row) => (
                                                <tr key={row.id} className="border-b border-slate-200">
                                                    <td className="px-2 py-1.5">{employeeName(row)}</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.legal_hours_breakdown?.base_salary_earned ?? 0)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.legal_hours_breakdown?.night_surcharge_amount ?? 0)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.legal_hours_breakdown?.sunday_holiday_surcharge_amount ?? 0)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {formatCurrency(row.legal_hours_breakdown?.overtime_amount ?? 0)}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-medium">
                                                        {formatCurrency(row.legal_hourly_subtotal ?? 0)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {signatures}
                    </>
                )}

                <div className="no-print mt-8 text-center">
                    <button onClick={() => window.print()} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
                        Imprimir o guardar PDF
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                        Para guardar como PDF: en el cuadro de impresion elige el destino
                        <strong> «Guardar como PDF» </strong>
                        {isDetailed ? '· cada empleado sale en una hoja distinta.' : null}
                    </p>
                </div>
            </div>
        </>
    );
}
