/** Helpers de presentacion compartidos por las pantallas de Empresas. */

export interface MembershipPlanRef {
    id: number;
    name: string;
    slug?: string | null;
    max_staff_users: number | null;
    max_employees?: number | null;
}

/** Iniciales del nombre, para el avatar cuando la empresa no tiene logo. */
export function companyInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-12-31` → `31 dic 2026`. Se parte la cadena en vez de usar `new Date` porque este
 *  ultimo interpreta la fecha en UTC y en Colombia adelanta el dia un día. */
export function formatDay(value: string | null | undefined): string | null {
    if (! value) return null;

    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    if (! y || ! m || ! d) return null;

    return `${d} ${MONTHS[m - 1]} ${y}`;
}

export interface MembershipLabel {
    text: string;
    /** `expired` y `soon` se pintan en rose y amber; el resto en gris. */
    tone: 'expired' | 'soon' | 'default';
}

/** Dias antes del vencimiento a partir de los cuales se avisa. Igual que en el controlador. */
export const EXPIRING_WINDOW_DAYS = 45;

export function membershipLabel(endsAt: string | null | undefined): MembershipLabel {
    const day = formatDay(endsAt);
    if (! day) {
        return { text: 'Sin vencimiento', tone: 'default' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = (endsAt as string).slice(0, 10).split('-').map(Number);
    const end = new Date(y, m - 1, d);

    const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) return { text: `Venció ${day}`, tone: 'expired' };
    if (days <= EXPIRING_WINDOW_DAYS) return { text: `Vence ${day}`, tone: 'soon' };

    return { text: `Vence ${day}`, tone: 'default' };
}

/** `true` cuando el staff usado roza el tope del plan (90 %). Igual criterio que el backend. */
export function isAtStaffLimit(used: number, limit: number | null | undefined): boolean {
    return limit != null && limit > 0 && used >= limit * 0.9;
}
