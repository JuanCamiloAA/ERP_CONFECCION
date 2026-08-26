import { Calculator, CheckCircle, Money, Printer } from '@phosphor-icons/react';
import { flowStep, PAYROLL_FLOW, stepLabel, type PayrollIconName, type PayrollStatus } from '@/lib/payrolls';

const ICONS = {
    Calculator,
    CheckCircle,
    Money,
    Printer,
} as const;

/** Icono de la accion siguiente, resuelto desde el nombre que devuelve `nextAction()`. */
export function PayrollActionIcon({ name, size = 15 }: { name: PayrollIconName; size?: number }) {
    const Icon = ICONS[name] ?? Calculator;

    return <Icon size={size} />;
}

/**
 * Pastilla de estado. Neutra en borrador, en acento mientras el periodo avanza y en verde
 * cuando ya se pago; el texto dice siempre el estado, asi que el color solo lo refuerza.
 */
export function PayrollStatePill({ status }: { status: PayrollStatus }) {
    if (status === 'pagado') {
        return (
            <span
                className="emp-pill capitalize"
                style={{ borderColor: 'var(--emp-ok)', color: 'var(--emp-ok)' }}
            >
                pagado
            </span>
        );
    }

    return (
        <span className={`emp-pill capitalize ${status === 'borrador' ? '' : 'emp-pill-accent'}`}>{status}</span>
    );
}

interface Props {
    status: PayrollStatus;
    /** 3 px en la tabla, 4 px en tarjeta y cabecera. */
    thickness?: number;
    /** El rotulo «Paso 2 de 4 · falta aprobar» bajo la barra. */
    showLabel?: boolean;
    className?: string;
}

/**
 * Los cuatro tramos del flujo.
 *
 * La barra es decorativa (`aria-hidden`): el estado se comunica con la pastilla y con el
 * texto de `stepLabel()`, para que el color no sea nunca el unico distintivo. El verde se
 * reserva para `pagado`; mientras el periodo sigue vivo los tramos van en acento.
 */
export function PayrollFlowBar({ status, thickness = 3, showLabel = false, className = '' }: Props) {
    const step = flowStep(status);
    const done = status === 'pagado' ? 'var(--emp-ok)' : 'var(--emp-accent-line)';

    return (
        <div className={className}>
            <div className="flex gap-[5px]" aria-hidden="true">
                {PAYROLL_FLOW.map((flowStatus, index) => (
                    <span
                        key={flowStatus}
                        className="flex-1 rounded-full"
                        style={{
                            height: `${thickness}px`,
                            backgroundColor: index <= step ? done : 'var(--emp-row)',
                        }}
                    />
                ))}
            </div>

            {showLabel ? (
                <p
                    className="mt-1.5 text-[11px]"
                    style={{ color: status === 'pagado' ? 'var(--emp-ok)' : 'var(--emp-accent-on)' }}
                >
                    {stepLabel(status)}
                </p>
            ) : null}
        </div>
    );
}

export default PayrollFlowBar;
