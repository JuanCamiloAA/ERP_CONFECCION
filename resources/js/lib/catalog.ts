/** Palabras que no aportan al codigo de un concepto. */
const STOPWORDS = new Set([
    'de', 'del', 'la', 'las', 'el', 'los', 'por', 'para', 'con', 'y', 'en', 'a', 'al', 'un', 'una',
]);

/** Quita tildes y deja solo A-Z y digitos. */
function normalize(word: string): string {
    return word
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

/**
 * Codigo sugerido a partir del nombre: las dos primeras palabras significativas.
 *
 * «Bonificación por productividad» → `BONPROD`. Es solo un punto de partida: el campo
 * sigue siendo editable, porque el codigo suele venir del plan de cuentas.
 */
export function suggestConceptCode(name: string): string {
    const words = String(name ?? '')
        .split(/\s+/)
        .map(normalize)
        .filter((word) => word.length > 0 && !STOPWORDS.has(word.toLowerCase()));

    if (words.length === 0) {
        return '';
    }

    if (words.length === 1) {
        return words[0].slice(0, 7);
    }

    return `${words[0].slice(0, 3)}${words[1].slice(0, 4)}`;
}

/** Mayusculas sin acentos ni simbolos, para escribir el codigo a mano. */
export function sanitizeConceptCode(value: string): string {
    return normalize(value).slice(0, 50);
}
