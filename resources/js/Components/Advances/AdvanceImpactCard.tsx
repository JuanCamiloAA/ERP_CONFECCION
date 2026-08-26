import { EmployeeAsideCard } from '@/Components/Employees/EmployeeFormLayout';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface AdvanceEmployeeContext {
    id: number;
    first_name: string;
    last_name: string;
    document_number: string;
    pending_balance: number;
    avg_net: number;
    advances_this_year: number;
    avg_amount: number;
    last_advance: { date: string; amount: number } | null;
}

/** Por encima de esta parte del neto, el anticipo deja el pago demasiado corto. */
export const RISKY_SHARE = 0.4;

interface Props {
    employee: AdvanceEmployeeContext | null;
    amount: number;
    period: { start: string | null; end: string | null; payroll_name?: string | null };
}

/**
 * Que le queda al empleado si se registra este anticipo.
 *
 * El formulario pedia un monto sin decir contra que se descuenta; aqui se ve el saldo que
 * ya arrastraba, lo que se suma y el neto que quedaria. Cuando el descuento se pasa de la
 * raya se avisa —en rojo— pero no se bloquea: quien autoriza el anticipo sabe por que lo
 * hace, y el sistema no esta para discutirlo.
 */
export function AdvanceImpactCard({ employee, amount, period }: Props) {
    const previous = employee?.pending_balance ?? 0;
    const total = previous + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    const avgNet = employee?.avg_net ?? 0;
    const net = Math.max(0, avgNet - total);
    const share = avgNet > 0 ? total / avgNet : 0;
    const risky = avgNet > 0 && share > RISKY_SHARE;

    const periodLabel =
        period.start && period.end ? `${formatDate(period.start)} — ${formatDate(period.end)}` : 'sin nómina abierta';

    return (
        <EmployeeAsideCard
            title="Efecto en la próxima nómina"
            subtitle={employee ? `${employee.first_name} ${employee.last_name} · ${periodLabel}` : 'Elige un empleado'}
        >
            <dl className="mt-2.5 flex flex-col gap-1.5 text-[12px]">
                {[
                    ['Saldo que ya tenía', employee ? formatCurrency(previous) : '—', 'var(--emp-text)'],
                    ['Este anticipo', amount > 0 ? formatCurrency(amount) : '—', 'var(--emp-text)'],
                    ['Total a descontar', employee ? formatCurrency(total) : '—', 'var(--emp-accent-on)'],
                ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                        <dt style={{ color: 'var(--emp-muted)' }}>{label}</dt>
                        <dd className="tabular-nums" style={{ color }}>
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>

            <div aria-hidden="true" className="my-3 h-px" style={{ backgroundColor: 'var(--emp-border)' }} />

            <p className="emp-kicker">Neto estimado del periodo</p>
            <p
                className="mt-1 text-[27px] leading-none tabular-nums"
                style={{ color: !employee || avgNet === 0 ? 'var(--emp-faint)' : risky ? 'var(--emp-danger)' : 'var(--emp-text)' }}
            >
                {employee && avgNet > 0 ? formatCurrency(net) : '—'}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                {employee && avgNet > 0
                    ? `Sobre un promedio de ${formatCurrency(avgNet)} en los últimos 3 periodos`
                    : 'Sin nóminas pagadas todavía para estimarlo'}
            </p>

            {employee && avgNet > 0 ? (
                <>
                    <div
                        aria-hidden="true"
                        className="mt-2.5 h-[6px] w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--emp-row)' }}
                    >
                        <span
                            className="block h-full rounded-full"
                            style={{
                                width: `${Math.min(100, Math.round(share * 100))}%`,
                                backgroundColor: risky ? 'var(--emp-danger)' : 'var(--emp-accent)',
                            }}
                        />
                    </div>
                    <p className="mt-1.5 text-[11px]" style={{ color: risky ? 'var(--emp-danger)' : 'var(--emp-subtle)' }}>
                        El descuento se lleva el {Math.round(share * 100)}% del pago.
                    </p>
                </>
            ) : null}
        </EmployeeAsideCard>
    );
}

/** Historial del empleado: si pide anticipos a menudo, conviene verlo antes de firmar. */
export function AdvanceHistoryCard({ employee }: { employee: AdvanceEmployeeContext | null }) {
    return (
        <EmployeeAsideCard title="Historial del empleado">
            <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
                {[
                    ['Anticipos este año', employee ? String(employee.advances_this_year) : '—'],
                    ['Promedio solicitado', employee && employee.avg_amount > 0 ? formatCurrency(employee.avg_amount) : '—'],
                    [
                        'Último',
                        employee?.last_advance
                            ? `${formatDate(employee.last_advance.date)} · ${formatCurrency(employee.last_advance.amount)}`
                            : '—',
                    ],
                ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                        <dt style={{ color: 'var(--emp-muted)' }}>{label}</dt>
                        <dd className="tabular-nums" style={{ color: 'var(--emp-text)' }}>
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </EmployeeAsideCard>
    );
}

export default AdvanceImpactCard;
