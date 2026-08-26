/**
 * Utilidades del calendario de festivos.
 *
 * Todo se calcula sobre la cadena `YYYY-MM-DD` y con `Date.UTC`, nunca con `new
 * Date('2026-01-06')` en hora local: esa lectura corre un dia hacia atras en Colombia
 * (UTC-5) y pinta el festivo en la casilla equivocada.
 */

export interface HolidayRow {
    id: number;
    date: string;
    name: string;
    original_date: string | null;
    is_emiliani_shifted: boolean;
    source: 'calculated' | 'manual';
}

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Semana que empieza en lunes, como se lee un calendario en Colombia. */
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Indice 0..6 con el lunes en 0. */
export function weekdayIndex(iso: string): number {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    const day = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();

    return (day + 6) % 7;
}

export function weekdayName(iso: string): string {
    return WEEKDAY_NAMES[weekdayIndex(iso)] ?? '';
}

/** Un festivo trasladado es el que cambio de fecha por la Ley Emiliani. */
export function isShifted(holiday: Pick<HolidayRow, 'is_emiliani_shifted'>): boolean {
    return Boolean(holiday.is_emiliani_shifted);
}

export interface MonthCell {
    /** null en los huecos de relleno antes del dia 1 y despues del ultimo. */
    iso: string | null;
    day: number | null;
    /** Domingo: se atenua cuando no es festivo. */
    isSunday: boolean;
}

export interface MonthGrid {
    month: number;
    label: string;
    cells: MonthCell[];
}

/**
 * Doce cuadriculas de 7 columnas, con huecos al principio y al final.
 *
 * Se rellena hasta completar semanas para que las columnas de todos los meses queden
 * alineadas bajo su inicial.
 */
export function buildMonthGrid(year: number): MonthGrid[] {
    return Array.from({ length: 12 }, (_, month) => {
        const first = new Date(Date.UTC(year, month, 1));
        const lead = (first.getUTCDay() + 6) % 7;
        const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        const cells: MonthCell[] = [];

        for (let i = 0; i < lead; i += 1) {
            cells.push({ iso: null, day: null, isSunday: false });
        }

        for (let day = 1; day <= days; day += 1) {
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            cells.push({ iso, day, isSunday: weekdayIndex(iso) === 6 });
        }

        while (cells.length % 7 !== 0) {
            cells.push({ iso: null, day: null, isSunday: false });
        }

        return { month, label: MONTH_NAMES[month] ?? '', cells };
    });
}

/** Festivos que caen de lunes a viernes: los que de verdad alteran la jornada. */
export function workdayHolidays(holidays: HolidayRow[]): number {
    return holidays.filter((holiday) => weekdayIndex(holiday.date) <= 4).length;
}
