import { EmployeeFormSection } from '@/Components/Employees/EmployeeFormSection';
import { NightBandField } from '@/Components/PayrollLegalParameters/NightBandField';
import { EmpInput, EmpSwitch, EmpTextarea } from '@/Components/UI/ModuleFields';
import {
    coversToday,
    dailyValue,
    suggestedDivisor,
    surchargeValue,
    type LegalParameterRow,
} from '@/lib/legalParameters';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

export interface PayrollLegalParameterFormData {
    effective_from: string;
    effective_to: string;
    weekly_legal_hours: string;
    monthly_hours_divisor: string;
    night_start_time: string;
    night_end_time: string;
    night_surcharge_percent: string;
    overtime_day_percent: string;
    overtime_night_percent: string;
    sunday_holiday_surcharge_percent: string;
    max_overtime_hours_per_day: string;
    max_overtime_hours_per_week: string;
    discount_unexcused_absences: boolean;
    absence_discount_percent: string;
    legal_reference: string;
}

/** Secciones del tramo, en el orden en que se leen. */
export const LEGAL_SECTIONS = [
    { id: 'vigencia', label: 'Vigencia' },
    { id: 'jornada', label: 'Jornada' },
    { id: 'nocturno', label: 'Franja nocturna' },
    { id: 'recargos', label: 'Recargos y extras' },
    { id: 'inasistencias', label: 'Inasistencias' },
    { id: 'referencia', label: 'Referencia legal' },
];

/** La transición de la Ley 2101 de 2021: 48 → 44 → 42 horas. */
const HOUR_PRESETS = [48, 44, 42];

/** Porcentajes del CST vigente; el boton «Cargar valores de ley» los escribe de golpe. */
export const LEGAL_DEFAULTS: Partial<PayrollLegalParameterFormData> = {
    night_surcharge_percent: '35',
    overtime_day_percent: '25',
    overtime_night_percent: '75',
    sunday_holiday_surcharge_percent: '75',
    max_overtime_hours_per_day: '2',
    max_overtime_hours_per_week: '12',
};

interface Props {
    data: PayrollLegalParameterFormData;
    setData: <K extends keyof PayrollLegalParameterFormData>(key: K, value: PayrollLegalParameterFormData[K]) => void;
    errors: Partial<Record<keyof PayrollLegalParameterFormData, string>>;
    /** Salario con el que se traducen los porcentajes a pesos. */
    salary: number;
}

export function PayrollLegalParameterFields({ data, setData, errors, salary }: Props) {
    const divisor = Number(data.monthly_hours_divisor) || 0;
    const suggested = suggestedDivisor(Number(data.weekly_legal_hours));
    const divisorMatches = suggested === 0 || Math.abs(divisor - suggested) < 0.005;

    const covers = coversToday({ effective_from: data.effective_from, effective_to: data.effective_to || null });

    const money = (percent: string) => formatCurrency(surchargeValue(salary, divisor, Number(percent) || 0));

    const percentFields: { key: keyof PayrollLegalParameterFormData; label: string; help: string }[] = [
        {
            key: 'night_surcharge_percent',
            label: 'Recargo nocturno',
            help: `Hora nocturna: ${money(data.night_surcharge_percent)}`,
        },
        {
            key: 'overtime_day_percent',
            label: 'Hora extra diurna',
            help: `${money(data.overtime_day_percent)} por hora`,
        },
        {
            key: 'overtime_night_percent',
            label: 'Hora extra nocturna',
            help: `${money(data.overtime_night_percent)} por hora`,
        },
        {
            key: 'sunday_holiday_surcharge_percent',
            label: 'Recargo dominical / festivo',
            help: `${money(data.sunday_holiday_surcharge_percent)} por hora`,
        },
    ];

    return (
        <>
            {/* --------------------------------------------------- vigencia */}
            <EmployeeFormSection id="vigencia" step={1} title="Vigencia" requirement="required">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <EmpInput
                        label="Vigente desde"
                        type="date"
                        required
                        value={data.effective_from}
                        onChange={(e) => setData('effective_from', e.target.value)}
                        error={errors.effective_from}
                    />
                    <EmpInput
                        label="Vigente hasta"
                        type="date"
                        value={data.effective_to}
                        onChange={(e) => setData('effective_to', e.target.value)}
                        error={errors.effective_to}
                        help="Vacío = indefinido, hasta que otro tramo lo reemplace."
                    />
                </div>

                {/* El servidor rechaza los solapes; el aviso de aqui dice si el tramo manda hoy. */}
                <p
                    className="emp-note mt-3"
                    style={
                        errors.effective_from
                            ? {
                                  borderLeftColor: 'var(--emp-danger)',
                                  backgroundColor: 'color-mix(in srgb, var(--emp-danger) 8%, transparent)',
                                  color: 'var(--emp-danger)',
                              }
                            : undefined
                    }
                >
                    {errors.effective_from ? (
                        errors.effective_from
                    ) : covers ? (
                        <>Este tramo cubre hoy: al guardar, la próxima nómina se liquida con estos valores.</>
                    ) : (
                        <>
                            Este tramo no cubre la fecha de hoy: entra en vigor cuando la nómina caiga dentro del rango
                            {data.effective_from ? ` (desde el ${formatDate(data.effective_from)})` : ''}.
                        </>
                    )}
                </p>
            </EmployeeFormSection>

            {/* ---------------------------------------------------- jornada */}
            <EmployeeFormSection id="jornada" step={2} title="Jornada" requirement="required">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                        <EmpInput
                            label="Jornada semanal legal"
                            type="number"
                            step="0.01"
                            min={1}
                            max={80}
                            required
                            value={data.weekly_legal_hours}
                            onChange={(e) => setData('weekly_legal_hours', e.target.value)}
                            error={errors.weekly_legal_hours}
                            help="Horas semanales de la jornada ordinaria."
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {HOUR_PRESETS.map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => {
                                        setData('weekly_legal_hours', String(hours));
                                        // El preset fija tambien el divisor: es el par que
                                        // tiene que cuadrar, no dos numeros sueltos.
                                        setData('monthly_hours_divisor', String(suggestedDivisor(hours)));
                                    }}
                                    className="emp-pill"
                                    style={{ height: '26px', cursor: 'pointer' }}
                                >
                                    {hours} h
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <EmpInput
                            label="Divisor mensual de horas"
                            type="number"
                            step="0.01"
                            min={1}
                            max={400}
                            required
                            value={data.monthly_hours_divisor}
                            onChange={(e) => setData('monthly_hours_divisor', e.target.value)}
                            error={errors.monthly_hours_divisor}
                            help={
                                suggested > 0
                                    ? `Con jornada de ${formatNumber(Number(data.weekly_legal_hours))} h el divisor habitual es ${suggested} (${formatNumber(
                                          Number(data.weekly_legal_hours),
                                      )} × 5).`
                                    : 'Divisor con el que se calcula el valor de la hora.'
                            }
                        />

                        {/* La incoherencia jornada/divisor paga todas las horas mal y hoy
                            nada la advierte. */}
                        {!divisorMatches ? (
                            <div className="mt-1.5">
                                <button
                                    type="button"
                                    onClick={() => setData('monthly_hours_divisor', String(suggested))}
                                    className="emp-btn emp-btn-sm"
                                    style={{ borderColor: 'var(--emp-danger)', color: 'var(--emp-danger)' }}
                                >
                                    Usar {suggested}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </EmployeeFormSection>

            {/* -------------------------------------------------- nocturno */}
            <EmployeeFormSection id="nocturno" step={3} title="Franja nocturna" requirement="required">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <EmpInput
                        label="Inicio"
                        type="time"
                        required
                        value={data.night_start_time}
                        onChange={(e) => setData('night_start_time', e.target.value)}
                        error={errors.night_start_time}
                    />
                    <EmpInput
                        label="Fin"
                        type="time"
                        required
                        value={data.night_end_time}
                        onChange={(e) => setData('night_end_time', e.target.value)}
                        error={errors.night_end_time}
                    />
                </div>

                <div className="mt-3">
                    <NightBandField start={data.night_start_time} end={data.night_end_time} />
                </div>
            </EmployeeFormSection>

            {/* -------------------------------------------------- recargos */}
            <EmployeeFormSection id="recargos" step={4} title="Recargos y horas extra" requirement="required">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                    {percentFields.map((field) => (
                        <EmpInput
                            key={field.key}
                            label={field.label}
                            type="number"
                            step="0.01"
                            min={0}
                            max={500}
                            required
                            value={data[field.key] as string}
                            onChange={(e) => setData(field.key, e.target.value as never)}
                            error={errors[field.key]}
                            help={field.help}
                        />
                    ))}

                    <EmpInput
                        label="Tope horas extra / día"
                        type="number"
                        step="0.01"
                        min={0}
                        max={24}
                        required
                        value={data.max_overtime_hours_per_day}
                        onChange={(e) => setData('max_overtime_hours_per_day', e.target.value)}
                        error={errors.max_overtime_hours_per_day}
                        help="Solo avisa cuando una jornada lo supera."
                    />
                    <EmpInput
                        label="Tope horas extra / semana"
                        type="number"
                        step="0.01"
                        min={0}
                        max={168}
                        required
                        value={data.max_overtime_hours_per_week}
                        onChange={(e) => setData('max_overtime_hours_per_week', e.target.value)}
                        error={errors.max_overtime_hours_per_week}
                        help="Solo avisa cuando una semana lo supera."
                    />
                </div>

                <p className="emp-note mt-3">
                    Las horas extra requieren autorización previa del Ministerio del Trabajo. El sistema no verifica ese
                    trámite: los topes de aquí solo avisan cuando una jornada los supera.
                </p>
            </EmployeeFormSection>

            {/* --------------------------------------------- inasistencias */}
            <EmployeeFormSection id="inasistencias" step={5} title="Descuento por inasistencia" requirement="optional">
                <div
                    className="rounded-[12px] px-3"
                    style={{
                        border: '1px solid var(--emp-border)',
                        backgroundColor: data.discount_unexcused_absences
                            ? 'color-mix(in srgb, var(--emp-danger) 6%, transparent)'
                            : 'var(--emp-field-alt)',
                    }}
                >
                    <EmpSwitch
                        checked={data.discount_unexcused_absences}
                        onChange={(value) => setData('discount_unexcused_absences', value)}
                        label="Descontar día hábil sin marcación"
                        description={
                            data.discount_unexcused_absences
                                ? 'Activo: cada día hábil esperado sin marcación baja el pago.'
                                : 'Desactivado: un día sin marcación no descuenta nada.'
                        }
                    />
                </div>

                <p
                    className="emp-note mt-3"
                    style={{
                        borderLeftColor: 'var(--emp-danger)',
                        backgroundColor: 'color-mix(in srgb, var(--emp-danger) 8%, transparent)',
                    }}
                >
                    La regla general es que el empleador no está obligado a pagar un día no trabajado sin justificación,
                    pero <strong style={{ color: 'var(--emp-danger)' }}>no se confunde con el tope del 20% de multas
                    disciplinarias del art. 113 del CST</strong>: es un concepto distinto. Verifícalo con tu asesor
                    legal o contable antes de activarlo.
                </p>

                {data.discount_unexcused_absences ? (
                    <div className="emp-reveal mt-3 sm:max-w-[340px]">
                        <EmpInput
                            label="% del valor del día a descontar"
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            required
                            value={data.absence_discount_percent}
                            onChange={(e) => setData('absence_discount_percent', e.target.value)}
                            error={errors.absence_discount_percent}
                            help={`Un día hábil sin marcación descuenta ${formatCurrency(
                                dailyValue(salary) * ((Number(data.absence_discount_percent) || 0) / 100),
                            )}.`}
                        />
                    </div>
                ) : null}
            </EmployeeFormSection>

            {/* ------------------------------------------------ referencia */}
            <EmployeeFormSection id="referencia" step={6} title="Referencia legal" requirement="optional">
                <EmpTextarea
                    label="Referencia"
                    rows={2}
                    value={data.legal_reference}
                    onChange={(e) => setData('legal_reference', e.target.value)}
                    error={errors.legal_reference}
                    placeholder="Ej. Ley 2101 de 2021 — jornada de 42 horas desde julio de 2026"
                    help="Se muestra bajo la vigencia en el listado: es lo que permite auditar por qué el tramo dice lo que dice."
                />
            </EmployeeFormSection>
        </>
    );
}

export default PayrollLegalParameterFields;
