import { clsx, type ClassValue } from 'clsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function formatCurrency(
    amount: number | string | null | undefined,
    currency: string = 'COP',
    locale: string = 'es-CO',
): string {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (value == null || Number.isNaN(value)) {
        return '$0';
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatNumber(value: number | string | null | undefined, locale: string = 'es-CO'): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num == null || Number.isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat(locale).format(num);
}

export function formatDate(date: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string {
    if (!date) return '-';
    try {
        const parsed = typeof date === 'string' ? parseISO(date) : date;
        return format(parsed, formatStr, { locale: es });
    } catch {
        return '-';
    }
}

export function formatDateTime(date: string | null | undefined): string {
    return formatDate(date, "dd/MM/yyyy HH:mm");
}

export function formatRelativeDate(date: string | null | undefined): string {
    if (!date) return '-';
    try {
        const parsed = parseISO(date);
        const diff = Date.now() - parsed.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'hace unos segundos';
        if (minutes < 60) return `hace ${minutes} min`;
        if (hours < 24) return `hace ${hours} h`;
        if (days < 30) return `hace ${days} dias`;

        return formatDate(date);
    } catch {
        return '-';
    }
}

export function generatePassword(length: number = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';

    const all = upper + lower + digits + special;

    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = password.length; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }

    return password
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
}

/** Etiqueta en selects de rol: incluye empresa o "(global)" para super_admin. */
export function formatRoleSelectLabel(role: { display_name: string; company?: { name: string } | null }): string {
    const companyName = role.company?.name?.trim();
    if (!companyName) {
        return `${role.display_name} (global)`;
    }
    return `${role.display_name} — ${companyName}`;
}

export function getInitials(name?: string | null, lastName?: string | null): string {
    const f = (name ?? '').trim().charAt(0);
    const l = (lastName ?? '').trim().charAt(0);
    const result = (f + l).toUpperCase();
    return result || 'U';
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function capitalize(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function truncate(text: string, length: number = 50): string {
    if (!text || text.length <= length) return text;
    return text.slice(0, length) + '...';
}
