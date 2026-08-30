/**
 * Nombre visible → codigo interno (`Pago decadal` → `pago_decadal`).
 *
 * Se quitan los acentos antes de filtrar: sin eso, «quincenal común» perdia la letra y
 * generaba `comn`, un codigo que ya no se parece a lo que el usuario escribio.
 */
export function slugifyCode(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
}
