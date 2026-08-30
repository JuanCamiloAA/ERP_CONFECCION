import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { BankLogo } from '@/Components/UI/BankLogo';
import { maskAccountDisplay } from '@/lib/banks';
import { mediaUrl } from '@/lib/mediaUrl';
import {
    clockLabel,
    deductionsTotal,
    employeeName,
    hoursFromMinutes,
    rowGross,
    sessionMinutes,
} from '@/lib/payrolls';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Advance, Company, Payroll, PayrollEmployee, Production, WorkDaySession } from '@/types';

interface Props {
    payroll: Payroll & { company?: Company };
    payrollEmployee: PayrollEmployee;
    workSessions: WorkDaySession[];
    productions: Production[];
}

const MODE_LABEL: Record<string, string> = {
    operations: 'Pago por operación',
    fixed_daily: 'Salario diario por jornada',
    hourly_legal: 'Jornada legal por horas',
};

/** Domingo calculado en UTC: `new Date('2026-08-30')` en Colombia cae un día antes. */
function isSunday(iso: string): boolean {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);

    return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay() === 0;
}

/**
 * Comprobante individual de nómina.
 *
 * Antes solo existia el informe «detallado» de todo el periodo: para entregarle su
 * liquidacion a una persona habia que imprimir la nomina entera. Reutiliza tal cual la
 * reticula de impresion de `Payrolls/Print` (carta, 12 mm, tinta y acento) para que los dos
 * documentos se vean como parte del mismo juego.
 */
export default function PayrollReceipt({ payroll, payrollEmployee: row, workSessions, productions }: Props) {
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => window.print(), 500);

        return () => clearTimeout(timer);
    }, []);

    const companyName = payroll.company?.name ?? 'Empresa';
    const logoSrc = payroll.company?.logo ? mediaUrl(payroll.company.logo) : undefined;
    const periodText = `${formatDate(payroll.period_start)} — ${formatDate(payroll.period_end)}`;

    const name = employeeName(row);
    const mode = row.employee?.payroll_mode ?? 'operations';
    const breakdown = row.legal_hours_breakdown ?? null;
    const hasLegal = Number(row.legal_hourly_subtotal ?? 0) > 0 && breakdown !== null;
    const hasDaily = Number(row.daily_work_subtotal ?? 0) > 0;

    const minutes = sessionMinutes(workSessions);
    const gross = rowGross(row);
    const dedTotal = deductionsTotal(row);
    const absence = Number(row.absence_discount_total ?? 0);

    const advancesList: Advance[] = row.advances ?? [];
    const delivered = advancesList.reduce((sum, a) => sum + Number(a.remaining_amount ?? 0), 0);
    const applied = Number(row.advances_discount ?? 0);
    const carried = Math.max(0, delivered - applied);
    const discountTotal = dedTotal + applied + absence;

    const units = productions.reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
    const prodValue = productions.reduce((sum, p) => sum + Number(p.total_value ?? 0), 0);

    /** Valor del día: sale del retrato legal cuando existe; si no, de la liquidación diaria. */
    const dayAmount = (session: WorkDaySession): number | null => {
        const legal = breakdown?.daily_detail?.find((d) => d.session_id === session.id);
        if (legal) return Number(legal.day_amount ?? 0);

        const daily = (row.validated_work_days ?? []).find((d) => d.session_id === session.id);
        if (daily) return Number(daily.day_earnings ?? 0);

        return null;
    };

    const isSpecialDay = (session: WorkDaySession): boolean => {
        const legal = breakdown?.daily_detail?.find((d) => d.session_id === session.id);
        if (legal) return Boolean(legal.is_sunday_holiday);

        return isSunday(session.work_date);
    };

    const share = async () => {
        const url = window.location.href;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                setSharing(true);
                await navigator.share({ title: `Comprobante ${name}`, text: `${payroll.name} · ${periodText}`, url });
            } catch {
                /* El usuario cerró la hoja de compartir; no hay nada que reportar. */
            } finally {
                setSharing(false);
            }

            return;
        }

        window.print();
    };

    const sectionTitle = (title: string, meta?: string) => (
        <div className="pd-sec">
            <span className="pd-sec-t">{title}</span>
            <span className="pd-sec-line" />
            {meta ? <span className="pd-sec-m">{meta}</span> : null}
        </div>
    );

    return (
        <>
            <Head title={`Comprobante ${name}`} />
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
                .pd-hi { color: var(--accent); }

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

                .pd-bar {
                    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
                    max-width: 62rem; margin: 0 auto; padding: 0.75rem 2rem;
                    border-bottom: 1px solid var(--line);
                }
                .pd-btn {
                    border-radius: 0.375rem; border: 1px solid var(--ink); background: #fff; color: var(--ink);
                    padding: 0.5rem 1.1rem; font-size: 0.8125rem; cursor: pointer;
                }
                .pd-btn-solid { background: var(--ink); color: #fff; }
                .pd-actions { display: flex; gap: 0.5rem; }

                @media (max-width: 640px) {
                    .pd-page { padding: 1rem; }
                    .pd-header, .pd-emp { flex-direction: column; gap: 0.75rem; }
                    .pd-doc { text-align: left; }
                    .pd-liq { grid-template-columns: 1fr; gap: 0.75rem; }
                    .pd-bar { padding: 0.75rem 1rem; }
                    .pd-btn { min-height: 48px; flex: 1; }
                }

                @media print {
                    body { background: #fff; }
                    .no-print { display: none !important; }
                    .pd-page { padding: 0; max-width: none; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-row-group; }
                    .pd-net, .pd-note, .pd-stats, .pd-signs { break-inside: avoid; page-break-inside: avoid; }
                }
            `}</style>

            <div className="pd">
                <div className="pd-bar no-print">
                    <div>
                        <p className="pd-label">Neto a pagar</p>
                        <p className="pd-stat-v">{formatCurrency(row.net_payment)}</p>
                    </div>
                    <div className="pd-actions">
                        <button type="button" className="pd-btn" onClick={() => share()} disabled={sharing}>
                            Compartir PDF
                        </button>
                        <button type="button" className="pd-btn pd-btn-solid" onClick={() => window.print()}>
                            Imprimir
                        </button>
                    </div>
                </div>

                <div className="pd-page">
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
                            <p className="pd-kicker">Comprobante de pago</p>
                            <p className="pd-title">Liquidación de Nómina</p>
                            <p className="pd-accent">{payroll.name}</p>
                            <p className="pd-meta">Periodo {periodText}</p>
                        </div>
                    </header>

                    <hr className="pd-rule" />

                    <div className="pd-emp">
                        <div>
                            <p className="pd-label">Empleado</p>
                            <p className="pd-emp-name">{name}</p>
                            <p className="pd-emp-meta">
                                <span className="pd-docnum">
                                    {row.employee?.document_type ?? 'Documento'} {row.employee?.document_number ?? '—'}
                                </span>
                                <span className="pd-mod">Modalidad {MODE_LABEL[mode] ?? MODE_LABEL.operations}</span>
                                {row.employee?.bank?.name ? (
                                    <span className="pd-dim">
                                        {row.employee.bank.name}
                                        {row.employee.bank_account_number ? ` · ${row.employee.bank_account_number}` : ''}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                        <div className="pd-stats">
                            {mode === 'operations' && productions.length > 0 ? (
                                <div className="pd-stat">
                                    <p className="pd-label">Operaciones</p>
                                    <p className="pd-stat-v">{formatNumber(units)}</p>
                                    <p className="pd-stat-s">unidades</p>
                                </div>
                            ) : null}
                            {workSessions.length > 0 ? (
                                <div className="pd-stat">
                                    <p className="pd-label">Jornadas</p>
                                    <p className="pd-stat-v">{workSessions.length}</p>
                                    <p className="pd-stat-s">
                                        {formatNumber(minutes)} min · {hoursFromMinutes(minutes)} h
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

                    {mode === 'operations' ? (
                        <>
                            {sectionTitle(
                                'Detalle de operaciones',
                                `${productions.length} ${productions.length === 1 ? 'registro' : 'registros'}`,
                            )}
                            {productions.length === 0 ? (
                                <p className="pd-empty">Sin producción liquidable en el periodo.</p>
                            ) : (
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
                                        {productions.map((production) => (
                                            <tr key={production.id}>
                                                <td>{formatDate(production.date)}</td>
                                                <td>
                                                    {production.reference ? (
                                                        <>
                                                            <span className="pd-ref">{production.reference.code}</span>{' '}
                                                            {production.reference.name}
                                                        </>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="pd-dim">{production.operation?.name ?? '—'}</td>
                                                <td className="pd-r">{formatNumber(production.quantity)}</td>
                                                <td className="pd-r">{formatCurrency(production.total_value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} className="pd-r">
                                                Total operaciones
                                            </td>
                                            <td className="pd-r">{formatNumber(units)}</td>
                                            <td className="pd-r">{formatCurrency(prodValue)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </>
                    ) : (
                        <>
                            {sectionTitle(
                                'Jornadas registradas',
                                `${workSessions.length} ${workSessions.length === 1 ? 'día' : 'días'}`,
                            )}
                            {workSessions.length === 0 ? (
                                <p className="pd-empty">Sin jornadas registradas en el periodo.</p>
                            ) : (
                                <table className="pd-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Entrada</th>
                                            <th>Salida</th>
                                            <th className="pd-r">Minutos</th>
                                            <th className="pd-r">Horas</th>
                                            <th className="pd-r">Valor del día</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workSessions.map((session) => {
                                            const special = isSpecialDay(session);
                                            const value = dayAmount(session);

                                            return (
                                                <tr key={session.id}>
                                                    <td className={special ? 'pd-hi' : undefined}>
                                                        {formatDate(session.work_date)}
                                                        {special ? ' · dom/festivo' : ''}
                                                    </td>
                                                    <td className="pd-dim">{clockLabel(session.clock_in_at)}</td>
                                                    <td className="pd-dim">{clockLabel(session.clock_out_at)}</td>
                                                    <td className="pd-r">{formatNumber(session.duration_minutes ?? 0)}</td>
                                                    <td className="pd-r">{hoursFromMinutes(Number(session.duration_minutes ?? 0))}</td>
                                                    <td className="pd-r">{value === null ? '—' : formatCurrency(value)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={3} className="pd-r">
                                                Total jornada
                                            </td>
                                            <td className="pd-r">{formatNumber(minutes)}</td>
                                            <td className="pd-r">{hoursFromMinutes(minutes)}</td>
                                            <td className="pd-r">
                                                {formatCurrency(
                                                    Number(row.legal_hourly_subtotal ?? 0) ||
                                                        Number(row.daily_work_subtotal ?? 0),
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </>
                    )}

                    {hasLegal && breakdown ? (
                        <>
                            {sectionTitle('Recargos y horas extra (ley)')}
                            <table className="pd-table">
                                <tbody>
                                    <tr>
                                        <td>Salario base del periodo</td>
                                        <td className="pd-r">{formatCurrency(breakdown.base_salary_earned)}</td>
                                    </tr>
                                    <tr>
                                        <td>Recargo nocturno</td>
                                        <td className="pd-r">{formatCurrency(breakdown.night_surcharge_amount)}</td>
                                    </tr>
                                    <tr>
                                        <td>Recargo dominical / festivo</td>
                                        <td className="pd-r">{formatCurrency(breakdown.sunday_holiday_surcharge_amount)}</td>
                                    </tr>
                                    <tr>
                                        <td>Horas extra</td>
                                        <td className="pd-r">{formatCurrency(breakdown.overtime_amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    ) : null}

                    {sectionTitle('Liquidación del periodo')}
                    <div className="pd-liq">
                        <div>
                            <p className="pd-liq-h">Devengos</p>
                            {mode === 'operations' ? (
                                <div className="pd-row">
                                    <span>Producido (pago por operación)</span>
                                    <span>{formatCurrency(row.production_total)}</span>
                                </div>
                            ) : null}
                            {hasDaily ? (
                                <div className="pd-row">
                                    <span>Jornada ({hoursFromMinutes(minutes)} h)</span>
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
                                <span>Conceptos manuales</span>
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
                            {delivered > 0 ? (
                                <div className="pd-row">
                                    <span className="pd-dim">Anticipos entregados</span>
                                    <span className="pd-dim">{formatCurrency(delivered)}</span>
                                </div>
                            ) : null}
                            <div className="pd-row">
                                <span>Anticipo aplicado en este periodo</span>
                                <span>− {formatCurrency(applied)}</span>
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

                    {carried > 0 ? (
                        <div className="pd-note">
                            <b>Saldo de anticipos</b>
                            <span>
                                Quedan {formatCurrency(carried)} de anticipos sin cubrir; el saldo se traslada al
                                siguiente periodo de liquidación.
                            </span>
                        </div>
                    ) : null}

                    {discountTotal > gross ? (
                        <div className="pd-note">
                            <b>Descuentos mayores al devengado</b>
                            <span>
                                Los descuentos ({formatCurrency(discountTotal)}) superan lo devengado ({formatCurrency(gross)}
                                ). El neto se ajusta a {formatCurrency(0)} y la diferencia de{' '}
                                {formatCurrency(discountTotal - gross)} no alcanza a descontarse en este periodo.
                            </span>
                        </div>
                    ) : null}

                    <div className="pd-signs">
                        <div className="pd-sign">
                            <p className="pd-sign-n">Firma responsable</p>
                            <p className="pd-sign-s">{companyName}</p>
                        </div>
                        <div className="pd-sign">
                            <p className="pd-sign-n">{name}</p>
                            <p className="pd-sign-s">Documento {row.employee?.document_number ?? '—'}</p>
                        </div>
                    </div>

                    <footer className="pd-foot">
                        <span>
                            {companyName}
                            {payroll.company?.nit ? ` · NIT ${payroll.company.nit}` : ''} · Comprobante de nómina
                        </span>
                        <span>Periodo {periodText}</span>
                    </footer>
                </div>
            </div>
        </>
    );
}
