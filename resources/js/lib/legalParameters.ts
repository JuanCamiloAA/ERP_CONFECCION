/**
 * Aritmetica de los parametros legales, compartida por el listado, el formulario y la
 * simulacion.
 *
 * Los porcentajes de la pantalla vieja no decian cuanto valen; estas funciones son las
 * que los traducen a pesos para que se puedan auditar.
 */

export interface LegalParameterRow {
    id: number;
    company_id: number | null;
    scope: 'global' | 'company';
    is_active: boolean;
    effective_from: string;
    effective_to: string | null;
    weekly_legal_hours: number;
    monthly_hours_divisor: number;
    night_start_time: string;
    night_end_time: string;
    night_surcharge_percent: number;
    overtime_day_percent: number;
    overtime_night_percent: number;
    sunday_holiday_surcharge_percent: number;
    max_overtime_hours_per_day: number;
    max_overtime_hours_per_week: number;
    discount_unexcused_absences: boolean;
    absence_discount_percent: number;
    legal_reference: string | null;
}

/** Valor de la hora ordinaria: salario mensual entre el divisor del tramo. */
export function hourlyValue(salary: number, divisor: number): number {
    const safeDivisor = Number(divisor);

    if (!Number.isFinite(safeDivisor) || safeDivisor <= 0) {
        return 0;
    }

    return Number(salary) / safeDivisor;
}

/**
 * Hora con recargo. El recargo se suma sobre la ordinaria: un 35% nocturno es 1,35 veces
 * la hora, no 0,35.
 */
export function surchargeValue(salary: number, divisor: number, percent: number): number {
    return hourlyValue(salary, divisor) * (1 + Number(percent || 0) / 100);
}

/**
 * Divisor habitual para una jornada semanal: horas × 5.
 *
 * Con 42 h el divisor es 210. La incoherencia entre jornada y divisor es el error real de
 * esta pantalla: 42 h con divisor 220 paga todas las horas por debajo.
 */
export function suggestedDivisor(weeklyHours: number): number {
    const hours = Number(weeklyHours);

    if (!Number.isFinite(hours) || hours <= 0) {
        return 0;
    }

    return Math.round(hours * 5);
}

/** Minutos desde medianoche de un `HH:mm`. */
function minutesOf(time: string): number {
    const [h, m] = String(time ?? '').slice(0, 5).split(':').map(Number);

    if (!Number.isFinite(h)) {
        return 0;
    }

    return h * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Duracion de la franja nocturna en horas. Si cruza la medianoche, se cuenta el tramo de
 * la noche y el de la madrugada.
 */
export function nightSpanHours(start: string, end: string): number {
    const from = minutesOf(start);
    const to = minutesOf(end);
    const span = to >= from ? to - from : 24 * 60 - from + to;

    return Math.round((span / 60) * 100) / 100;
}

/** Tramos a pintar en la barra de 24 h, en porcentaje del ancho. */
export function nightSegments(start: string, end: string): { left: number; width: number }[] {
    const from = minutesOf(start);
    const to = minutesOf(end);
    const day = 24 * 60;
    const pct = (minutes: number) => (minutes / day) * 100;

    if (to >= from) {
        return [{ left: pct(from), width: pct(to - from) }];
    }

    return [
        { left: pct(from), width: pct(day - from) },
        { left: 0, width: pct(to) },
    ];
}

/** Valor de un dia de salario: el mes comercial de 30 dias del CST. */
export function dailyValue(salary: number): number {
    return Number(salary) / 30;
}

/** Rango de vigencia legible; `effective_to` vacio es indefinido. */
export function coversToday(parameter: Pick<LegalParameterRow, 'effective_from' | 'effective_to'>): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const from = String(parameter.effective_from ?? '').slice(0, 10);
    const to = parameter.effective_to ? String(parameter.effective_to).slice(0, 10) : null;

    if (!from) {
        return false;
    }

    return from <= today && (to === null || to >= today);
}
