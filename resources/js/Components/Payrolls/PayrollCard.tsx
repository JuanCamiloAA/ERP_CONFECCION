import { Link } from '@inertiajs/react';
import { PayrollFlowBar, PayrollStatePill } from '@/Components/Payrolls/PayrollFlowBar';
import {
    PayrollActionsMenu,
    PayrollNextActionButton,
    type PayrollRowData,
} from '@/Components/Payrolls/PayrollRow';
import { usePermissions } from '@/contexts/PermissionsContext';
import { isClosed, shortPeriod } from '@/lib/payrolls';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface Props {
    payroll: PayrollRowData;
    onDelete: (payroll: PayrollRowData) => void;
    showCompany?: boolean;
}

/**
 * Nomina en movil.
 *
 * Lo que se consulta desde el telefono es el paso del flujo y el neto; por eso la barra y
 * la cifra ocupan el cuerpo de la tarjeta y la accion siguiente queda a 48 px, al alcance
 * del pulgar. Las cerradas se atenuan: siguen consultables, pero ya no piden nada.
 */
export function PayrollCard({ payroll, onDelete, showCompany = false }: Props) {
    const perms = usePermissions();
    const closed = isClosed(payroll.status);
    const employees = payroll.payroll_employees_count;

    return (
        <article className={`emp-card p-[14px] ${closed ? 'emp-row-off' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                        {shortPeriod(payroll.period_start, payroll.period_end)}
                    </p>
                    {perms.can('payrolls.show.view') ? (
                        <Link
                            href={route('payrolls.show', payroll.id)}
                            className="mt-0.5 block truncate text-[15px]"
                            style={{ color: 'var(--emp-text)' }}
                        >
                            {payroll.name}
                        </Link>
                    ) : (
                        <p className="mt-0.5 truncate text-[15px]" style={{ color: 'var(--emp-text)' }}>
                            {payroll.name}
                        </p>
                    )}
                    <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        {payroll.type}
                        {employees != null && employees > 0 ? ` · ${formatNumber(employees)} empleados` : ''}
                    </p>
                    {showCompany && payroll.company?.name ? (
                        <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--emp-faint)' }}>
                            {payroll.company.name}
                        </p>
                    ) : null}
                </div>

                <div className="flex shrink-0 items-start gap-1">
                    <PayrollStatePill status={payroll.status} />
                    <PayrollActionsMenu payroll={payroll} onDelete={onDelete} />
                </div>
            </div>

            <PayrollFlowBar status={payroll.status} thickness={4} showLabel className="mt-3" />

            <div
                className="mt-3 flex items-end justify-between gap-3 pt-3"
                style={{ borderTop: '1px solid var(--emp-row)' }}
            >
                <div className="min-w-0">
                    <p className="emp-kicker">Neto</p>
                    <p
                        className="text-[22px] leading-none tabular-nums"
                        style={{ color: closed ? 'var(--emp-text)' : 'var(--emp-accent-on)' }}
                    >
                        {formatCurrency(payroll.total_amount)}
                    </p>
                </div>

                <PayrollNextActionButton
                    payroll={payroll}
                    className="emp-btn emp-btn-primary shrink-0"
                    iconSize={17}
                />
            </div>
        </article>
    );
}

export default PayrollCard;
