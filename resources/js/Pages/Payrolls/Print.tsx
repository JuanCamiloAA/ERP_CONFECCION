import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Advance, Company, Payroll, PayrollEmployee, Production, WorkDaySession } from '@/types';

interface Props {
    payroll: Payroll & { company?: Company; payroll_employees: PayrollEmployee[] };
    /** "general": una fila por empleado (resumen). "detailed": una hoja por empleado con su detalle. */
    mode?: 'general' | 'detailed';
    productionsByEmployee?: Record<string, Production[]>;
    workSessionsByEmployee?: Record<string, WorkDaySession[]>;
}

const MODE_LABEL: Record<string, string> = {
    operations: 'Pago por operación',
    fixed_daily: 'Salario diario por jornada',
    hourly_legal: 'Jornada legal por horas',
};

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

/** Saldo entregado antes de este periodo, lo aplicado aqui y lo que se traslada al siguiente. */
function advanceSummary(row: PayrollEmployee): { entregado: number; aplicado: number; saldo: number } {
    const advances: Advance[] = row.advances ?? [];
    const entregado = advances.reduce((s, a) => s + Number(a.remaining_amount ?? 0), 0);
    const aplicado = Number(row.advances_discount ?? 0);

    return { entregado, aplicado, saldo: Math.max(0, entregado - aplicado) };
}

/** Horas con un decimal fijo ("9,0"), para que la columna quede alineada y no salte de formato. */
function hoursFromMinutes(minutes: number): string {
    return (minutes / 60).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

    const companyName = payroll.company?.name ?? 'Empresa';
    const logoSrc = payroll.company?.logo ? mediaUrl(payroll.company.logo) : undefined;
    const periodText = `${formatDate(payroll.period_start)} — ${formatDate(payroll.period_end)}`;

    /** Encabezado corporativo. En detallado se repite al inicio de cada hoja. */
    const companyHeader = () => (
        <header className="pd-header">
            <div className="pd-brand">
                <div className="pd-logo">
                    {logoSrc ? <img src={logoSrc} alt={companyName} /> : <span>{companyName.charAt(0)}</span>}
                </div>
                <div>
                    <p className="pd-company">{companyName}</p>
                    {payroll.company?.nit ? <p className="pd-meta">NIT {payroll.company.nit}</p> : null}
                    {payroll.company?.address ? <p className="pd-meta">{payroll.company.address}</p> : null}
                    {payroll.company?.phone ? <p className="pd-meta">Tel: {payroll.company.phone}</p> : null}
                </div>
            </div>
            <div className="pd-doc">
                <p className="pd-kicker">{isDetailed ? 'Informe detallado por empleado' : 'Informe general'}</p>
                <p className="pd-title">Liquidación de Nómina</p>
                <p className="pd-accent">{payroll.name}</p>
                <p className="pd-meta">Periodo {periodText}</p>
            </div>
        </header>
    );

    const sectionTitle = (title: string, meta?: string) => (
        <div className="pd-sec">
            <span className="pd-sec-t">{title}</span>
            <span className="pd-sec-line" />
            {meta ? <span className="pd-sec-m">{meta}</span> : null}
        </div>
    );

    const pageFooter = () => (
        <footer className="pd-foot">
            <span>
                {companyName}
                {payroll.company?.nit ? ` · NIT ${payroll.company.nit}` : ''} · Liquidación de nómina
            </span>
            <span>Periodo {periodText}</span>
        </footer>
    );

    return (
        <>
            <Head title={`Imprimir ${payroll.name}`} />
            <style>{`
                @page { size: letter; margin: 12mm; }

                .pd {
                    --ink: #111827;
                    --muted: #6b7280;
                    --faint: #9ca3af;
                    --line: #e5e7eb;
                    --accent: #c2410c;
                    --link: #1d4ed8;
                    --panel: #f9fafb;
                    color: var(--ink);
                    background: #fff;
                    font-variant-numeric: tabular-nums;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .pd-page { max-width: 62rem; margin: 0 auto; padding: 2rem; }

                .pd-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 2rem; }
                .pd-brand { display: flex; align-items: flex-start; gap: 0.875rem; }
                .pd-logo {
                    width: 3rem; height: 3rem; flex: none; border-radius: 9999px;
                    background: var(--ink); color: #fff; overflow: hidden;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; font-weight: 700;
                }
                .pd-logo img { width: 100%; height: 100%; object-fit: cover; }
                .pd-company { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
                .pd-meta { font-size: 0.6875rem; color: var(--muted); margin-top: 0.1rem; }
                .pd-doc { text-align: right; }
                .pd-kicker {
                    font-size: 0.625rem; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.11em; color: var(--accent);
                }
                .pd-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.015em; margin-top: 0.15rem; }
                .pd-accent { font-size: 0.6875rem; color: var(--accent); margin-top: 0.15rem; }

                .pd-rule { border: 0; border-top: 2px solid var(--ink); margin: 0.7rem 0 0.85rem; }

                .pd-emp { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; }
                .pd-label {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.12em; color: var(--faint);
                }
                .pd-emp-name { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em; margin-top: 0.15rem; }
                .pd-emp-meta { display: flex; flex-wrap: wrap; gap: 0.875rem; margin-top: 0.25rem; font-size: 0.6875rem; }
                .pd-docnum { color: var(--link); }
                .pd-mod { color: var(--accent); }

                .pd-stats { display: flex; border: 1px solid var(--line); border-radius: 0.375rem; background: var(--panel); }
                .pd-stat { padding: 0.55rem 0.95rem; border-left: 1px solid var(--line); }
                .pd-stat:first-child { border-left: 0; }
                .pd-stat-v { font-size: 1.05rem; font-weight: 700; line-height: 1.15; margin-top: 0.1rem; }
                .pd-stat-s { font-size: 0.5625rem; color: var(--faint); margin-top: 0.05rem; }

                .pd-sec { display: flex; align-items: center; gap: 0.625rem; margin: 0.95rem 0 0.3rem; }
                .pd-sec-t {
                    font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.12em; color: var(--ink); white-space: nowrap;
                }
                .pd-sec-line { flex: 1; height: 1px; background: var(--line); }
                .pd-sec-m { font-size: 0.625rem; color: var(--faint); white-space: nowrap; }

                .pd-table { width: 100%; border-collapse: collapse; font-size: 0.6875rem; }
                .pd-table th {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
                    color: var(--faint); text-align: left; padding: 0.35rem 0.5rem;
                    border-bottom: 1px solid var(--line);
                }
                .pd-table td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
                .pd-table tfoot td {
                    font-weight: 700; border-top: 1px solid var(--ink); border-bottom: 0; padding-top: 0.45rem;
                }
                .pd-r { text-align: right; }
                .pd-c { text-align: center; }
                .pd-ref { color: var(--link); }
                .pd-dim { color: var(--muted); }

                .pd-liq { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 0.5rem; }
                .pd-liq-h {
                    font-size: 0.5625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
                    color: var(--faint); padding-bottom: 0.3rem; border-bottom: 1px solid var(--line);
                }
                .pd-row {
                    display: flex; justify-content: space-between; gap: 1rem;
                    font-size: 0.6875rem; padding: 0.24rem 0; border-bottom: 1px solid #f3f4f6;
                }
                .pd-row-t {
                    display: flex; justify-content: space-between; gap: 1rem;
                    font-size: 0.75rem; font-weight: 700; padding-top: 0.4rem; border-top: 1px solid var(--ink);
                }

                .pd-net {
                    display: flex; align-items: center; justify-content: space-between;
                    background: var(--ink); color: #fff; border-radius: 0.375rem;
                    padding: 0.7rem 1.1rem; margin-top: 0.85rem;
                }
                .pd-net-l { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
                .pd-net-s { font-size: 0.5625rem; color: #9ca3af; margin-top: 0.1rem; }
                .pd-net-v { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }

                .pd-note {
                    display: flex; gap: 0.5rem; margin-top: 0.7rem; padding: 0.5rem 0.75rem;
                    border-left: 3px solid var(--accent); background: #fff7ed; font-size: 0.625rem;
                }
                .pd-note b { color: var(--accent); }

                .pd-signs { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 1.9rem; }
                .pd-sign { border-top: 1px solid var(--ink); padding-top: 0.35rem; text-align: center; }
                .pd-sign-n { font-size: 0.6875rem; font-weight: 600; }
                .pd-sign-s { font-size: 0.5625rem; color: var(--faint); margin-top: 0.05rem; }

                .pd-foot {
                    display: flex; justify-content: space-between; gap: 1rem;
                    margin-top: 1rem; padding-top: 0.4rem; border-top: 1px solid var(--line);
                    font-size: 0.5625rem; color: var(--faint);
                }

                .pd-empty { font-size: 0.6875rem; color: var(--muted); padding: 0.5rem 0; }
                .pd-hint-sm { font-size: 0.5625rem; color: var(--faint); margin-top: 0.35rem; }

                .pd-actions { text-align: center; margin-top: 2rem; }
                .pd-btn {
                    border-radius: 0.375rem; background: #4f46e5; color: #fff;
                    padding: 0.5rem 1.1rem; font-size: 0.8125rem; border: 0; cursor: pointer;
                }
                .pd-hint { font-size: 0.6875rem; color: var(--muted); margin-top: 0.5rem; }

                @media print {
                    body { background: #fff; }
                    .no-print { display: none !important; }
                    .pd-page { padding: 0; max-width: none; }
                    /* Cada empleado (y el resumen final) arranca en hoja nueva. */
                    .page-break { break-before: page; page-break-before: always; margin-top: 0 !important; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-row-group; }
                    .pd-net, .pd-note, .pd-stats { break-inside: avoid; page-break-inside: avoid; }
                }
            `}</style>

            <div className="pd">
                <div className="pd-page">
                    {/* En detallado el encabezado va dentro de cada seccion, para que se repita por hoja. */}
                    {isDetailed ? null : (
                        <>
                            {companyHeader()}
                            <hr className="pd-rule" />
                        </>
                    )}

                    {isDetailed ? (
                        <>
                            {rows.length === 0 ? (
                                <p className="pd-empty">Esta nómina no tiene empleados calculados.</p>
                            ) : null}

                            {rows.map((row, index) => {
                                const prods = productionsByEmployee[String(row.employee_id)] ?? [];
                                const sessions = workSessionsByEmployee[String(row.employee_id)] ?? [];
                                const gross = rowGross(row);
                                const dedTotal = deductionsTotal(row);
                                const adv = advanceSummary(row);
                                const absence = Number(row.absence_discount_total ?? 0);
                                const discountTotal = dedTotal + adv.aplicado + absence;
                                const hasLegal = Number(row.legal_hourly_subtotal ?? 0) > 0;
                                const hasDaily = Number(row.daily_work_subtotal ?? 0) > 0;
                                const prodUnits = prods.reduce((s, p) => s + Number(p.quantity ?? 0), 0);
                                const prodValue = prods.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
                                const sessionMinutes = sessions.reduce((s, w) => s + Number(w.duration_minutes ?? 0), 0);

                                return (
                                    <section key={row.id} className={index > 0 ? 'page-break' : ''}>
                                        {companyHeader()}
                                        <hr className="pd-rule" />

                                        <div className="pd-emp">
                                            <div>
                                                <p className="pd-label">Empleado</p>
                                                <p className="pd-emp-name">{employeeName(row)}</p>
                                                <p className="pd-emp-meta">
                                                    <span className="pd-docnum">
                                                        Documento {row.employee?.document_number ?? '—'}
                                                    </span>
                                                    <span className="pd-mod">
                                                        Modalidad{' '}
                                                        {MODE_LABEL[row.employee?.payroll_mode ?? 'operations'] ??
                                                            'Pago por operación'}
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="pd-stats">
                                                {prods.length > 0 ? (
                                                    <div className="pd-stat">
                                                        <p className="pd-label">Operaciones</p>
                                                        <p className="pd-stat-v">{formatNumber(prodUnits)}</p>
                                                        <p className="pd-stat-s">unidades</p>
                                                    </div>
                                                ) : null}
                                                {sessions.length > 0 ? (
                                                    <div className="pd-stat">
                                                        <p className="pd-label">Jornadas</p>
                                                        <p className="pd-stat-v">{sessions.length}</p>
                                                        <p className="pd-stat-s">
                                                            {formatNumber(sessionMinutes)} min · {hoursFromMinutes(sessionMinutes)} h
                                                        </p>
                                                    </div>
                                                ) : null}
                                                <div className="pd-stat">
                                                    <p className="pd-label">Bruto</p>
                                                    <p className="pd-stat-v">{formatCurrency(gross)}</p>
                                                    <p className="pd-stat-s">devengado</p>
                                                </div>
                                            </div>
                                        </div>

                                        {prods.length > 0 ? (
                                            <>
                                                {sectionTitle(
                                                    'Detalle de operaciones',
                                                    `${prods.length} ${prods.length === 1 ? 'registro' : 'registros'}`,
                                                )}
                                                <table className="pd-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Fecha</th>
                                                            <th>Referencia</th>
                                                            <th>Operación</th>
                                                            <th className="pd-r">Cant.</th>
                                                            <th className="pd-r">Valor</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {prods.map((p) => (
                                                            <tr key={p.id}>
                                                                <td>{formatDate(p.date)}</td>
                                                                <td>
                                                                    {p.reference ? (
                                                                        <>
                                                                            <span className="pd-ref">{p.reference.code}</span>{' '}
                                                                            {p.reference.name}
                                                                        </>
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </td>
                                                                <td className="pd-dim">{p.operation?.name ?? '—'}</td>
                                                                <td className="pd-r">{formatNumber(p.quantity)}</td>
                                                                <td className="pd-r">{formatCurrency(p.total_value)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={3} className="pd-r">
                                                                Total operaciones
                                                            </td>
                                                            <td className="pd-r">{formatNumber(prodUnits)}</td>
                                                            <td className="pd-r">{formatCurrency(prodValue)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                                {Number(row.production_total) === 0 ? (
                                                    <p className="pd-hint-sm">
                                                        Registro informativo: en esta modalidad la producción no se paga por
                                                        operación, por eso no suma al devengado.
                                                    </p>
                                                ) : null}
                                            </>
                                        ) : null}

                                        {sessions.length > 0 ? (
                                            <>
                                                {sectionTitle(
                                                    'Jornadas registradas',
                                                    `${sessions.length} ${sessions.length === 1 ? 'día' : 'días'}`,
                                                )}
                                                <table className="pd-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Fecha</th>
                                                            <th>Entrada</th>
                                                            <th>Salida</th>
                                                            <th className="pd-r">Minutos</th>
                                                            <th className="pd-r">Horas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sessions.map((s) => (
                                                            <tr key={s.id}>
                                                                <td>{formatDate(s.work_date)}</td>
                                                                <td className="pd-dim">
                                                                    {s.clock_in_at
                                                                        ? new Date(s.clock_in_at).toLocaleTimeString([], {
                                                                              hour: '2-digit',
                                                                              minute: '2-digit',
                                                                          })
                                                                        : '—'}
                                                                </td>
                                                                <td className="pd-dim">
                                                                    {s.clock_out_at
                                                                        ? new Date(s.clock_out_at).toLocaleTimeString([], {
                                                                              hour: '2-digit',
                                                                              minute: '2-digit',
                                                                          })
                                                                        : '—'}
                                                                </td>
                                                                <td className="pd-r">{formatNumber(s.duration_minutes ?? 0)}</td>
                                                                <td className="pd-r">
                                                                    {hoursFromMinutes(Number(s.duration_minutes ?? 0))}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={3} className="pd-r">
                                                                Total jornada
                                                            </td>
                                                            <td className="pd-r">{formatNumber(sessionMinutes)}</td>
                                                            <td className="pd-r">{hoursFromMinutes(sessionMinutes)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </>
                                        ) : null}

                                        {hasLegal && row.legal_hours_breakdown ? (
                                            <>
                                                {sectionTitle('Recargos y horas extra (ley)')}
                                                <table className="pd-table">
                                                    <tbody>
                                                        <tr>
                                                            <td>Salario base del periodo</td>
                                                            <td className="pd-r">
                                                                {formatCurrency(row.legal_hours_breakdown.base_salary_earned)}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>Recargo nocturno</td>
                                                            <td className="pd-r">
                                                                {formatCurrency(row.legal_hours_breakdown.night_surcharge_amount)}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>Recargo dominical / festivo</td>
                                                            <td className="pd-r">
                                                                {formatCurrency(
                                                                    row.legal_hours_breakdown.sunday_holiday_surcharge_amount,
                                                                )}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>Horas extra</td>
                                                            <td className="pd-r">
                                                                {formatCurrency(row.legal_hours_breakdown.overtime_amount)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </>
                                        ) : null}

                                        {sectionTitle('Liquidación del periodo')}
                                        <div className="pd-liq">
                                            <div>
                                                <p className="pd-liq-h">Devengos</p>
                                                <div className="pd-row">
                                                    <span>Producido (pago por operación)</span>
                                                    <span>{formatCurrency(row.production_total)}</span>
                                                </div>
                                                {hasDaily ? (
                                                    <div className="pd-row">
                                                        <span>Jornada ({hoursFromMinutes(sessionMinutes)} h)</span>
                                                        <span>{formatCurrency(row.daily_work_subtotal ?? 0)}</span>
                                                    </div>
                                                ) : null}
                                                {hasLegal ? (
                                                    <div className="pd-row">
                                                        <span>Jornada legal, recargos y extras</span>
                                                        <span>{formatCurrency(row.legal_hourly_subtotal ?? 0)}</span>
                                                    </div>
                                                ) : null}
                                                <div className="pd-row">
                                                    <span>Ajustes manuales</span>
                                                    <span>{formatCurrency(row.adjustments_subtotal ?? 0)}</span>
                                                </div>
                                                <div className="pd-row-t">
                                                    <span>Total bruto</span>
                                                    <span>{formatCurrency(gross)}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="pd-liq-h">Descuentos</p>
                                                <div className="pd-row">
                                                    <span>Deducciones de ley</span>
                                                    <span>− {formatCurrency(dedTotal)}</span>
                                                </div>
                                                {adv.entregado > 0 ? (
                                                    <div className="pd-row">
                                                        <span className="pd-dim">Anticipos entregados</span>
                                                        <span className="pd-dim">{formatCurrency(adv.entregado)}</span>
                                                    </div>
                                                ) : null}
                                                <div className="pd-row">
                                                    <span>Anticipo aplicado en este periodo</span>
                                                    <span>− {formatCurrency(adv.aplicado)}</span>
                                                </div>
                                                {absence > 0 ? (
                                                    <div className="pd-row">
                                                        <span>Descuento por inasistencia</span>
                                                        <span>− {formatCurrency(absence)}</span>
                                                    </div>
                                                ) : null}
                                                <div className="pd-row-t">
                                                    <span>Total descuentos</span>
                                                    <span>− {formatCurrency(discountTotal)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pd-net">
                                            <div>
                                                <p className="pd-net-l">Neto a pagar</p>
                                                <p className="pd-net-s">Periodo {periodText}</p>
                                            </div>
                                            <p className="pd-net-v">{formatCurrency(row.net_payment)}</p>
                                        </div>

                                        {adv.saldo > 0 ? (
                                            <div className="pd-note">
                                                <b>Saldo de anticipos</b>
                                                <span>
                                                    Quedan {formatCurrency(adv.saldo)} de anticipos sin cubrir; el saldo se
                                                    traslada al siguiente periodo de liquidación.
                                                </span>
                                            </div>
                                        ) : null}

                                        {discountTotal > gross ? (
                                            <div className="pd-note">
                                                <b>Descuentos mayores al devengado</b>
                                                <span>
                                                    Los descuentos ({formatCurrency(discountTotal)}) superan lo devengado (
                                                    {formatCurrency(gross)}). El neto se ajusta a {formatCurrency(0)} y la
                                                    diferencia de {formatCurrency(discountTotal - gross)} no alcanza a
                                                    descontarse en este periodo.
                                                </span>
                                            </div>
                                        ) : null}

                                        <div className="pd-signs">
                                            <div className="pd-sign">
                                                <p className="pd-sign-n">Firma responsable</p>
                                                <p className="pd-sign-s">{companyName}</p>
                                            </div>
                                            <div className="pd-sign">
                                                <p className="pd-sign-n">{employeeName(row)}</p>
                                                <p className="pd-sign-s">
                                                    Documento {row.employee?.document_number ?? '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {pageFooter()}
                                    </section>
                                );
                            })}

                            {rows.length > 0 ? (
                                <section className="page-break">
                                    {companyHeader()}
                                    <hr className="pd-rule" />
                                    {sectionTitle(
                                        'Resumen general',
                                        `${rows.length} ${rows.length === 1 ? 'empleado' : 'empleados'}`,
                                    )}
                                    <table className="pd-table">
                                        <thead>
                                            <tr>
                                                <th>Empleado</th>
                                                <th>Documento</th>
                                                <th className="pd-r">Bruto</th>
                                                <th className="pd-r">Deducciones</th>
                                                <th className="pd-r">Anticipos</th>
                                                <th className="pd-r">Neto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row.id}>
                                                    <td>{employeeName(row)}</td>
                                                    <td className="pd-dim">{row.employee?.document_number ?? '—'}</td>
                                                    <td className="pd-r">{formatCurrency(rowGross(row))}</td>
                                                    <td className="pd-r">{formatCurrency(deductionsTotal(row))}</td>
                                                    <td className="pd-r">{formatCurrency(row.advances_discount)}</td>
                                                    <td className="pd-r">
                                                        <b>{formatCurrency(row.net_payment)}</b>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={2} className="pd-r">
                                                    Totales
                                                </td>
                                                <td className="pd-r">{formatCurrency(totalGross)}</td>
                                                <td className="pd-r">{formatCurrency(totalDeductions)}</td>
                                                <td className="pd-r">{formatCurrency(totalAdvances)}</td>
                                                <td className="pd-r">{formatCurrency(payroll.total_amount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    <div className="pd-net">
                                        <div>
                                            <p className="pd-net-l">Total nómina</p>
                                            <p className="pd-net-s">
                                                {rows.length} {rows.length === 1 ? 'empleado' : 'empleados'} · Periodo{' '}
                                                {periodText}
                                            </p>
                                        </div>
                                        <p className="pd-net-v">{formatCurrency(payroll.total_amount)}</p>
                                    </div>

                                    {pageFooter()}
                                </section>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {sectionTitle(
                                'Detalle por empleado',
                                `${rows.length} ${rows.length === 1 ? 'empleado' : 'empleados'}`,
                            )}
                            <table className="pd-table">
                                <thead>
                                    <tr>
                                        <th>Empleado</th>
                                        <th>Documento</th>
                                        <th className="pd-r">Producido</th>
                                        {showDaily ? <th className="pd-r">Jornada</th> : null}
                                        {showLegal ? <th className="pd-r">Legal (horas)</th> : null}
                                        <th className="pd-r">Ajustes</th>
                                        <th className="pd-r">Bruto</th>
                                        <th className="pd-r">Deducciones</th>
                                        <th className="pd-r">Anticipos</th>
                                        <th className="pd-r">Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="pd-empty pd-c">
                                                Esta nómina no tiene empleados calculados.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row) => (
                                            <tr key={row.id}>
                                                <td>{employeeName(row)}</td>
                                                <td className="pd-dim">{row.employee?.document_number ?? '—'}</td>
                                                <td className="pd-r">{formatCurrency(row.production_total)}</td>
                                                {showDaily ? (
                                                    <td className="pd-r">{formatCurrency(row.daily_work_subtotal ?? 0)}</td>
                                                ) : null}
                                                {showLegal ? (
                                                    <td className="pd-r">{formatCurrency(row.legal_hourly_subtotal ?? 0)}</td>
                                                ) : null}
                                                <td className="pd-r">{formatCurrency(row.adjustments_subtotal ?? 0)}</td>
                                                <td className="pd-r">{formatCurrency(rowGross(row))}</td>
                                                <td className="pd-r">{formatCurrency(deductionsTotal(row))}</td>
                                                <td className="pd-r">{formatCurrency(row.advances_discount)}</td>
                                                <td className="pd-r">
                                                    <b>{formatCurrency(row.net_payment)}</b>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {rows.length > 0 ? (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2} className="pd-r">
                                                Totales
                                            </td>
                                            <td className="pd-r">{formatCurrency(totalProduction)}</td>
                                            {showDaily ? <td className="pd-r">{formatCurrency(totalDaily)}</td> : null}
                                            {showLegal ? <td className="pd-r">{formatCurrency(totalLegal)}</td> : null}
                                            <td className="pd-r">{formatCurrency(totalAdjustments)}</td>
                                            <td className="pd-r">{formatCurrency(totalGross)}</td>
                                            <td className="pd-r">{formatCurrency(totalDeductions)}</td>
                                            <td className="pd-r">{formatCurrency(totalAdvances)}</td>
                                            <td className="pd-r">{formatCurrency(payroll.total_amount)}</td>
                                        </tr>
                                    </tfoot>
                                ) : null}
                            </table>

                            {showLegal ? (
                                <>
                                    {sectionTitle('Desglose modalidad por horas (ley)')}
                                    <table className="pd-table">
                                        <thead>
                                            <tr>
                                                <th>Empleado</th>
                                                <th className="pd-r">Salario base</th>
                                                <th className="pd-r">Recargo nocturno</th>
                                                <th className="pd-r">Recargo dom/festivo</th>
                                                <th className="pd-r">Horas extra</th>
                                                <th className="pd-r">Subtotal legal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows
                                                .filter((r) => Number(r.legal_hourly_subtotal ?? 0) > 0)
                                                .map((row) => (
                                                    <tr key={row.id}>
                                                        <td>{employeeName(row)}</td>
                                                        <td className="pd-r">
                                                            {formatCurrency(row.legal_hours_breakdown?.base_salary_earned ?? 0)}
                                                        </td>
                                                        <td className="pd-r">
                                                            {formatCurrency(
                                                                row.legal_hours_breakdown?.night_surcharge_amount ?? 0,
                                                            )}
                                                        </td>
                                                        <td className="pd-r">
                                                            {formatCurrency(
                                                                row.legal_hours_breakdown?.sunday_holiday_surcharge_amount ?? 0,
                                                            )}
                                                        </td>
                                                        <td className="pd-r">
                                                            {formatCurrency(row.legal_hours_breakdown?.overtime_amount ?? 0)}
                                                        </td>
                                                        <td className="pd-r">
                                                            <b>{formatCurrency(row.legal_hourly_subtotal ?? 0)}</b>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </>
                            ) : null}

                            <div className="pd-net">
                                <div>
                                    <p className="pd-net-l">Total nómina</p>
                                    <p className="pd-net-s">
                                        {rows.length} {rows.length === 1 ? 'empleado' : 'empleados'} · Periodo {periodText}
                                    </p>
                                </div>
                                <p className="pd-net-v">{formatCurrency(payroll.total_amount)}</p>
                            </div>

                            <div className="pd-signs">
                                <div className="pd-sign">
                                    <p className="pd-sign-n">Firma responsable</p>
                                    <p className="pd-sign-s">{companyName}</p>
                                </div>
                                <div className="pd-sign">
                                    <p className="pd-sign-n">Firma empleado</p>
                                    <p className="pd-sign-s">Recibí conforme</p>
                                </div>
                            </div>

                            {pageFooter()}
                        </>
                    )}

                    <div className="no-print pd-actions">
                        <button onClick={() => window.print()} className="pd-btn">
                            Imprimir o guardar PDF
                        </button>
                        <p className="pd-hint">
                            Para guardar como PDF: en el cuadro de impresión elige el destino «Guardar como PDF»
                            {isDetailed ? ' · cada empleado sale en una hoja distinta.' : '.'}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
