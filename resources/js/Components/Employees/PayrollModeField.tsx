import { CalendarBlank, Clock, Money, type Icon } from '@phosphor-icons/react';

export type PayrollMode = 'operations' | 'fixed_daily' | 'hourly_legal';

interface ModeOption {
    value: PayrollMode;
    /** Rotulo corto para el segmentado de escritorio. */
    label: string;
    /** Una linea de explicacion; solo la muestran las tarjetas de movil. */
    hint: string;
    icon: Icon;
}

export const PAYROLL_MODES: ModeOption[] = [
    {
        value: 'operations',
        label: 'Por operaciones',
        hint: 'Su pago sale de la producción registrada.',
        icon: Money,
    },
    {
        value: 'fixed_daily',
        label: 'Salario diario fijo',
        hint: 'Un valor por jornada trabajada.',
        icon: CalendarBlank,
    },
    {
        value: 'hourly_legal',
        label: 'Por horas — legal',
        hint: 'Jornada, recargos y horas extra de ley.',
        icon: Clock,
    },
];

export function payrollModeLabel(mode: PayrollMode | string | undefined): string {
    return PAYROLL_MODES.find((m) => m.value === mode)?.label ?? 'Por operaciones';
}

interface Props {
    value: PayrollMode;
    onChange: (mode: PayrollMode) => void;
    error?: string;
}

/**
 * Selector de modalidad de nomina.
 *
 * Son tres opciones excluyentes que deciden que campos existen debajo: verlas todas
 * pesa mas que ahorrar el espacio de un desplegable. En escritorio van como segmentado a
 * ancho completo; en movil, como tarjetas apiladas, porque a 360px los rotulos de tres
 * columnas se cortan y la explicacion no cabe en ninguna.
 */
export function PayrollModeField({ value, onChange, error }: Props) {
    return (
        <div>
            <span className="emp-label">Modalidad de nómina</span>

            {/* Escritorio: segmentado. */}
            <div className="emp-seg hidden sm:flex" role="radiogroup" aria-label="Modalidad de nómina">
                {PAYROLL_MODES.map((mode) => (
                    <button
                        key={mode.value}
                        type="button"
                        role="radio"
                        aria-checked={value === mode.value}
                        onClick={() => onChange(mode.value)}
                        className={`emp-seg-item ${value === mode.value ? 'emp-seg-on' : ''}`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Movil: tarjetas de radio, con la explicacion visible. */}
            <div className="flex flex-col gap-2 sm:hidden" role="radiogroup" aria-label="Modalidad de nómina">
                {PAYROLL_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const active = value === mode.value;

                    return (
                        <button
                            key={mode.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(mode.value)}
                            className="flex items-start gap-3 rounded-[10px] border p-3 text-left"
                            style={{
                                borderColor: active ? 'var(--emp-accent)' : 'var(--emp-border)',
                                backgroundColor: active ? 'var(--emp-accent-fill)' : 'transparent',
                            }}
                        >
                            <Icon
                                size={19}
                                className="mt-0.5 shrink-0"
                                style={{ color: active ? 'var(--emp-accent-line)' : 'var(--emp-subtle)' }}
                            />
                            <span className="min-w-0">
                                <span
                                    className="block text-[14px]"
                                    style={{ color: active ? 'var(--emp-accent-on)' : 'var(--emp-text)' }}
                                >
                                    {mode.label}
                                </span>
                                <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    {mode.hint}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

export default PayrollModeField;
