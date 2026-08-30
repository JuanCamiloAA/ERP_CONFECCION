/**
 * Enmascarado de datos bancarios, compartido por la ficha del empleado y el desprendible.
 *
 * Vivía suelto dentro de una pantalla; al necesitarlo también el desprendible, tenerlo en
 * dos sitios habría dejado dos formas distintas de tapar la misma cuenta.
 */

export function maskAccountDisplay(num: string | null | undefined): string {
    if (! num) return '—';
    if (num.length <= 4) return '****';

    return `${'*'.repeat(Math.min(6, num.length - 4))}${num.slice(-4)}`;
}

export function maskKeyDisplay(key: string | null | undefined): string {
    if (! key) return '—';
    if (key.length <= 4) return '****';

    return `${'*'.repeat(Math.min(4, key.length - 4))}${key.slice(-4)}`;
}
