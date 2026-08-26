/**
 * Monto en letras para comprobantes (español de Colombia).
 *
 * El valor en letras no es adorno: es lo que impide que alguien altere una cifra en un
 * comprobante firmado. Por eso se escribe en mayúsculas y termina siempre en
 * «PESOS M/CTE.» (moneda corriente), como en cualquier recibo de caja.
 *
 * Se redondea a pesos: el módulo de anticipos no maneja centavos.
 */

/** 0…29 en una sola palabra. Desde VEINTIUNO el español no separa («veinte y uno» no existe). */
const UNITS = [
    '',
    'UNO',
    'DOS',
    'TRES',
    'CUATRO',
    'CINCO',
    'SEIS',
    'SIETE',
    'OCHO',
    'NUEVE',
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISÉIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
    'VEINTE',
    'VEINTIUNO',
    'VEINTIDÓS',
    'VEINTITRÉS',
    'VEINTICUATRO',
    'VEINTICINCO',
    'VEINTISÉIS',
    'VEINTISIETE',
    'VEINTIOCHO',
    'VEINTINUEVE',
];

const TENS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

const HUNDREDS = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
];

/**
 * Apócope ante sustantivo: «un peso», «veintiún mil», «ciento un pesos».
 *
 * Se aplica siempre porque en un comprobante el número nunca va suelto: le sigue MIL,
 * MILLONES o PESOS.
 */
function apocopate(words: string): string {
    if (words.endsWith('VEINTIUNO')) {
        return `${words.slice(0, -'VEINTIUNO'.length)}VEINTIÚN`;
    }

    if (words.endsWith('UNO')) {
        return `${words.slice(0, -'UNO'.length)}UN`;
    }

    return words;
}

/** Grupo de tres cifras (1…999). */
function chunk(n: number): string {
    // CIEN exacto; con resto se vuelve CIENTO (cien uno no existe).
    if (n === 100) {
        return 'CIEN';
    }

    const hundreds = HUNDREDS[Math.floor(n / 100)];
    const rest = n % 100;

    let tail: string;
    if (rest < 30) {
        tail = UNITS[rest];
    } else {
        const unit = rest % 10;
        // La «Y» solo va entre decena y unidad: CUARENTA Y DOS, nunca CIENTO Y DOS.
        tail = unit === 0 ? TENS[Math.floor(rest / 10)] : `${TENS[Math.floor(rest / 10)]} Y ${UNITS[unit]}`;
    }

    return [hundreds, tail].filter(Boolean).join(' ');
}

/** Escribe un entero no negativo. Devuelve cadena vacía para 0 (lo resuelve quien llama). */
function spell(n: number): string {
    if (n < 1000) {
        return chunk(n);
    }

    if (n < 1_000_000) {
        const thousands = Math.floor(n / 1000);
        const rest = n % 1000;
        // MIL nunca lleva UN delante: son «mil pesos», no «un mil pesos».
        const head = thousands === 1 ? 'MIL' : `${apocopate(spell(thousands))} MIL`;

        return rest === 0 ? head : `${head} ${spell(rest)}`;
    }

    if (n < 1_000_000_000_000) {
        const millions = Math.floor(n / 1_000_000);
        const rest = n % 1_000_000;
        const head = millions === 1 ? 'UN MILLÓN' : `${apocopate(spell(millions))} MILLONES`;

        return rest === 0 ? head : `${head} ${spell(rest)}`;
    }

    const billions = Math.floor(n / 1_000_000_000_000);
    const rest = n % 1_000_000_000_000;
    const head = billions === 1 ? 'UN BILLÓN' : `${apocopate(spell(billions))} BILLONES`;

    return rest === 0 ? head : `${head} ${spell(rest)}`;
}

/**
 * Monto en letras, listo para imprimir.
 *
 * @example amountToWords(250000)  // 'DOSCIENTOS CINCUENTA MIL PESOS M/CTE.'
 * @example amountToWords(1000000) // 'UN MILLÓN PESOS M/CTE.'
 * @example amountToWords(0)       // 'CERO PESOS M/CTE.'
 */
export function amountToWords(amount: number | string | null | undefined): string {
    const parsed = typeof amount === 'string' ? Number.parseFloat(amount) : Number(amount);
    const safe = Number.isFinite(parsed) ? (parsed as number) : 0;
    const rounded = Math.round(Math.abs(safe));

    const words = rounded === 0 ? 'CERO' : apocopate(spell(rounded));
    const noun = rounded === 1 ? 'PESO' : 'PESOS';
    const sign = safe < 0 && rounded !== 0 ? 'MENOS ' : '';

    return `${sign}${words} ${noun} M/CTE.`;
}

export default amountToWords;
