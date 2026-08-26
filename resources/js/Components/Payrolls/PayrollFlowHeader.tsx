import { ArrowsClockwise } from '@phosphor-icons/react';
import { PayrollActionIcon, PayrollFlowBar } from '@/Components/Payrolls/PayrollFlowBar';
import { usePermissions } from '@/contexts/PermissionsContext';
import {
    FLOW_STEP_LABELS,
    flowStep,
    nextAction,
    stepLabel,
    type PayrollActionKey,
    type PayrollStatus,
} from '@/lib/payrolls';
import { formatDate, formatRelativeDate } from '@/lib/utils';
import type { Payroll } from '@/types';

interface Props {
    payroll: Payroll & { updated_at?: string };
    onAction: (action: Exclude<PayrollActionKey, 'export'>) => void;
    /** Version reducida para movil: barra, paso, pista y «Recalcular». */
    compact?: boolean;
}

/**
 * Cabecera del detalle: en que paso esta el periodo y cual es la accion siguiente.
 *
 * Es la pieza que resuelve el problema de fondo del modulo. Antes el estado era una
 * etiqueta en minusculas y habia que deducir que tocaba hacer; aqui el paso, su fecha y el
 * boton que corresponde estan en la misma linea de lectura.
 *
 * «Recalcular» solo aparece en `calculado`: en borrador la accion primaria ya es calcular,
 * y ofrecer los dos botones juntos obliga a elegir entre dos nombres para lo mismo.
 */
export function PayrollFlowHeader({ payroll, onAction, compact = false }: Props) {
    const perms = usePermissions();
    const status = payroll.status as PayrollStatus;
    const step = flowStep(status);
    const action = nextAction(status);

    const canRecalculate = status === 'calculado' && perms.can('payrolls.show.calculate');
    const canRunAction = action.action !== 'export' && perms.can(action.permission);

    const metaFor = (index: number): string => {
        const isCurrent = index === step;

        if (index === 0) {
            return `creada ${formatDate(payroll.created_at)}${isCurrent ? ' · paso actual' : ''}`;
        }

        if (isCurrent) {
            return `${formatRelativeDate(payroll.updated_at ?? payroll.created_at)} · paso actual`;
        }

        return FLOW_STEP_LABELS[index]?.meta ?? '';
    };

    const primaryButton =
        action.action === 'export' ? (
            <a
                href={route('payrolls.export', { payroll: payroll.id, mode: 'detailed' })}
                target="_blank"
                rel="noreferrer"
                className="emp-btn emp-btn-primary"
                style={{ height: compact ? undefined : '38px' }}
            >
                <PayrollActionIcon name={action.icon} size={15} />
                {action.label}
            </a>
        ) : canRunAction ? (
            <button
                type="button"
                onClick={() => onAction(action.action as Exclude<PayrollActionKey, 'export'>)}
                className="emp-btn emp-btn-primary"
                style={{ height: compact ? undefined : '38px' }}
            >
                <PayrollActionIcon name={action.icon} size={15} />
                {action.label}
            </button>
        ) : null;

    const recalculateButton = canRecalculate ? (
        <button type="button" onClick={() => onAction('calculate')} className="emp-btn">
            <ArrowsClockwise size={15} />
            Recalcular
        </button>
    ) : null;

    if (compact) {
        return (
            <section className="emp-card mt-4 p-[14px]">
                <PayrollFlowBar status={status} thickness={4} />
                <p
                    className="mt-2 text-[12px]"
                    style={{ color: status === 'pagado' ? 'var(--emp-ok)' : 'var(--emp-accent-on)' }}
                >
                    {stepLabel(status)}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {action.hint}
                </p>
                {recalculateButton ? <div className="mt-3">{recalculateButton}</div> : null}
            </section>
        );
    }

    return (
        <section className="emp-card mt-4 flex flex-wrap items-start gap-x-[22px] gap-y-4 p-[16px_18px]">
            <div className="min-w-[320px] flex-1">
                <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                    {FLOW_STEP_LABELS.map((flowLabel, index) => (
                        <span
                            key={flowLabel.status}
                            className="rounded-full"
                            style={{
                                height: '4px',
                                backgroundColor:
                                    index <= step
                                        ? status === 'pagado'
                                            ? 'var(--emp-ok)'
                                            : 'var(--emp-accent-line)'
                                        : 'var(--emp-row)',
                            }}
                        />
                    ))}
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {FLOW_STEP_LABELS.map((flowLabel, index) => (
                        <div key={flowLabel.status} className="min-w-0">
                            <p
                                className="truncate text-[12px]"
                                style={{
                                    color:
                                        index === step
                                            ? 'var(--emp-accent-on)'
                                            : index < step
                                              ? 'var(--emp-muted)'
                                              : 'var(--emp-subtle)',
                                }}
                            >
                                {flowLabel.title}
                            </p>
                            <p className="truncate text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                {metaFor(index)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="max-w-[280px] pl-[22px]" style={{ borderLeft: '1px solid var(--emp-border)' }}>
                <p className="emp-kicker">Acción siguiente</p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {action.hint}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {recalculateButton}
                {primaryButton}
            </div>
        </section>
    );
}

export default PayrollFlowHeader;
