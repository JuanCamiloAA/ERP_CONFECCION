import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';

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

interface Props {
    data: PayrollLegalParameterFormData;
    setData: <K extends keyof PayrollLegalParameterFormData>(key: K, value: PayrollLegalParameterFormData[K]) => void;
    errors: Partial<Record<keyof PayrollLegalParameterFormData, string>>;
}

export function PayrollLegalParameterFields({ data, setData, errors }: Props) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title="Vigencia" description="Rango de fechas en que rige este tramo." />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Vigente desde"
                        type="date"
                        value={data.effective_from}
                        onChange={(e) => setData('effective_from', e.target.value)}
                        error={errors.effective_from}
                        required
                    />
                    <Input
                        label="Vigente hasta (vacio = indefinido)"
                        type="date"
                        value={data.effective_to}
                        onChange={(e) => setData('effective_to', e.target.value)}
                        error={errors.effective_to}
                    />
                </div>
            </Card>

            <Card>
                <CardHeader title="Jornada" description="Jornada semanal legal y divisor mensual de horas usado para el valor/hora." />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Jornada semanal legal (horas)"
                        type="number"
                        step="0.01"
                        value={data.weekly_legal_hours}
                        onChange={(e) => setData('weekly_legal_hours', e.target.value)}
                        error={errors.weekly_legal_hours}
                        required
                    />
                    <Input
                        label="Divisor mensual de horas"
                        type="number"
                        step="0.01"
                        value={data.monthly_hours_divisor}
                        onChange={(e) => setData('monthly_hours_divisor', e.target.value)}
                        error={errors.monthly_hours_divisor}
                        description="Ej. jornada 42h -> divisor 210 (42 x 5)."
                        required
                    />
                </div>
            </Card>

            <Card>
                <CardHeader title="Horario nocturno" description="Inicio y fin de la franja nocturna (puede cruzar medianoche)." />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Inicio jornada nocturna"
                        type="time"
                        value={data.night_start_time}
                        onChange={(e) => setData('night_start_time', e.target.value)}
                        error={errors.night_start_time}
                        required
                    />
                    <Input
                        label="Fin jornada nocturna"
                        type="time"
                        value={data.night_end_time}
                        onChange={(e) => setData('night_end_time', e.target.value)}
                        error={errors.night_end_time}
                        required
                    />
                </div>
            </Card>

            <Card>
                <CardHeader title="Recargos y horas extra" description="Porcentajes sobre el valor/hora ordinaria y topes legales." />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Input
                        label="Recargo nocturno (%)"
                        type="number"
                        step="0.01"
                        value={data.night_surcharge_percent}
                        onChange={(e) => setData('night_surcharge_percent', e.target.value)}
                        error={errors.night_surcharge_percent}
                        suffix="%"
                        required
                    />
                    <Input
                        label="Hora extra diurna (%)"
                        type="number"
                        step="0.01"
                        value={data.overtime_day_percent}
                        onChange={(e) => setData('overtime_day_percent', e.target.value)}
                        error={errors.overtime_day_percent}
                        suffix="%"
                        required
                    />
                    <Input
                        label="Hora extra nocturna (%)"
                        type="number"
                        step="0.01"
                        value={data.overtime_night_percent}
                        onChange={(e) => setData('overtime_night_percent', e.target.value)}
                        error={errors.overtime_night_percent}
                        suffix="%"
                        required
                    />
                    <Input
                        label="Recargo dominical/festivo (%)"
                        type="number"
                        step="0.01"
                        value={data.sunday_holiday_surcharge_percent}
                        onChange={(e) => setData('sunday_holiday_surcharge_percent', e.target.value)}
                        error={errors.sunday_holiday_surcharge_percent}
                        suffix="%"
                        required
                    />
                    <Input
                        label="Tope horas extra / dia"
                        type="number"
                        step="0.01"
                        value={data.max_overtime_hours_per_day}
                        onChange={(e) => setData('max_overtime_hours_per_day', e.target.value)}
                        error={errors.max_overtime_hours_per_day}
                        suffix="h"
                        required
                    />
                    <Input
                        label="Tope horas extra / semana"
                        type="number"
                        step="0.01"
                        value={data.max_overtime_hours_per_week}
                        onChange={(e) => setData('max_overtime_hours_per_week', e.target.value)}
                        error={errors.max_overtime_hours_per_week}
                        suffix="h"
                        required
                    />
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Recordatorio: las horas extra requieren autorizacion previa del Ministerio del Trabajo. El sistema no
                    verifica ese tramite; es responsabilidad de la empresa.
                </p>
            </Card>

            <Card>
                <CardHeader title="Descuento por inasistencia" description="Dia habil esperado sin marcacion de jornada." />
                <div className="mt-4 space-y-4">
                    <Switch
                        checked={data.discount_unexcused_absences}
                        onChange={(v) => setData('discount_unexcused_absences', v)}
                        label="Descontar dia habil sin marcacion"
                        description="Desactivado por defecto. Actívalo solo con acompañamiento legal/contable."
                    />
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                        Caveat legal: la regla general es que el empleador no esta obligado a pagar un dia no trabajado sin
                        justificacion, pero no confundir con el tope del 20% de multas disciplinarias (art. 113 CST) — es un
                        concepto distinto. Verifica con tu asesor legal/contable antes de activar.
                    </div>
                    <Input
                        label="% del valor del dia a descontar"
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={data.absence_discount_percent}
                        onChange={(e) => setData('absence_discount_percent', e.target.value)}
                        error={errors.absence_discount_percent}
                        suffix="%"
                        disabled={!data.discount_unexcused_absences}
                        required
                    />
                </div>
            </Card>

            <Card>
                <CardHeader title="Referencia legal" description="Nota informativa (ej. ley o articulo que sustenta este tramo)." />
                <div className="mt-4">
                    <Textarea
                        label="Referencia"
                        value={data.legal_reference}
                        onChange={(e) => setData('legal_reference', e.target.value)}
                        error={errors.legal_reference}
                        rows={2}
                    />
                </div>
            </Card>
        </div>
    );
}

export default PayrollLegalParameterFields;
