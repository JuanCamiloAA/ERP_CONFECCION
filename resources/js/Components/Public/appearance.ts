import type { CSSProperties } from 'react';

/**
 * Apariencia de un bloque de la landing: tamaño, fondo y animación.
 *
 * El super usuario la edita desde la pestaña «Diseño» del editor y se guarda en
 * `data.appearance`. Aquí solo se traduce a CSS: el catálogo de opciones vive en
 * config/landing_appearance.php y los valores por defecto de cada tipo de bloque
 * en config/landing_blocks.php, de modo que el contenido ya publicado se ve igual
 * aunque nunca se haya tocado esta pestaña.
 */

type Dict = Record<string, unknown>;

export interface Appearance {
    height: string;
    align: string;
    width: string;
    pad_top: string;
    pad_bottom: string;
    bg_type: string;
    bg_color: string;
    bg_image: string;
    bg_fit: string;
    bg_position: string;
    bg_fixed: boolean;
    bg_texture: string;
    bg_gradient: string;
    overlay: number;
    bg_blur: number;
    anim: string;
    anim_speed: string;
    anim_delay: number;
    anim_stagger: string;
    anim_once: boolean;
    parallax: string;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const num = (v: unknown, fallback: number): number => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Apariencia neutra: el bloque se ve como antes de que existiera esta pestaña. */
const BASE: Appearance = {
    height: 'auto',
    align: 'start',
    width: 'normal',
    pad_top: 'md',
    pad_bottom: 'md',
    bg_type: 'none',
    bg_color: '',
    bg_image: '',
    bg_fit: 'cover',
    bg_position: 'center',
    bg_fixed: false,
    bg_texture: 'dots',
    bg_gradient: 'accent',
    overlay: 0,
    bg_blur: 0,
    anim: 'none',
    anim_speed: 'normal',
    anim_delay: 0,
    anim_stagger: 'normal',
    anim_once: true,
    parallax: 'none',
};

/**
 * Mezcla los valores por defecto del tipo de bloque con lo que haya guardado el
 * editor. Una clave vacía cae al valor por defecto: así un campo que se limpia
 * vuelve al comportamiento del catálogo en vez de dejar el bloque a medias.
 */
export function resolveAppearance(defaults: Dict | undefined, saved: unknown): Appearance {
    const d = { ...BASE, ...(defaults ?? {}) } as Dict;
    const s = (saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}) as Dict;
    const pick = (key: keyof Appearance): unknown => (s[key] === '' || s[key] == null ? d[key] : s[key]);

    return {
        height: str(pick('height'), BASE.height),
        align: str(pick('align'), BASE.align),
        width: str(pick('width'), BASE.width),
        pad_top: str(pick('pad_top'), BASE.pad_top),
        pad_bottom: str(pick('pad_bottom'), BASE.pad_bottom),
        bg_type: str(pick('bg_type'), BASE.bg_type),
        bg_color: str(pick('bg_color'), BASE.bg_color),
        // El servidor manda la URL ya firmada en `bg_image_url`; `bg_image` es la ruta
        // guardada, que solo sirve como respaldo del contenido antiguo (URL absolutas).
        bg_image: str(s.bg_image_url) || str(pick('bg_image'), BASE.bg_image),
        bg_fit: str(pick('bg_fit'), BASE.bg_fit),
        bg_position: str(pick('bg_position'), BASE.bg_position),
        bg_fixed: bool(pick('bg_fixed'), BASE.bg_fixed),
        bg_texture: str(pick('bg_texture'), BASE.bg_texture),
        bg_gradient: str(pick('bg_gradient'), BASE.bg_gradient),
        overlay: num(pick('overlay'), BASE.overlay),
        bg_blur: num(pick('bg_blur'), BASE.bg_blur),
        anim: str(pick('anim'), BASE.anim),
        anim_speed: str(pick('anim_speed'), BASE.anim_speed),
        anim_delay: num(pick('anim_delay'), BASE.anim_delay),
        anim_stagger: str(pick('anim_stagger'), BASE.anim_stagger),
        anim_once: bool(pick('anim_once'), BASE.anim_once),
        parallax: str(pick('parallax'), BASE.parallax),
    };
}

/* ------------------------------------------------------------------ tamaño */

const HEIGHT: Record<string, string> = {
    auto: '0',
    third: '38svh',
    half: '55svh',
    tall: '78svh',
    screen: '100svh',
};

const ALIGN: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
};

const WIDTH: Record<string, string> = {
    narrow: '48rem',
    normal: '72rem',
    wide: '88rem',
    full: '100%',
};

/** Escala de espacio vertical; crece con el ancho de pantalla sin media queries. */
const PAD: Record<string, string> = {
    none: '0rem',
    xs: 'clamp(0.75rem, 2vw, 1rem)',
    sm: 'clamp(1.5rem, 4vw, 2.5rem)',
    md: 'clamp(3.5rem, 6vw, 5rem)',
    lg: 'clamp(4rem, 8vw, 6rem)',
    xl: 'clamp(5.5rem, 11vw, 8rem)',
};

/* ------------------------------------------------------------------- fondo */

/** Colores del lenguaje público; el editor también admite un hex propio. */
const PALETTE: Record<string, string> = {
    bg: 'var(--pub-bg)',
    surface: 'var(--pub-surface)',
    band: 'var(--pub-band)',
    accent_fill: 'var(--pub-accent-fill)',
    accent: 'var(--pub-accent)',
    black: 'color-mix(in srgb, var(--pub-bg) 55%, black)',
};

/**
 * Muestrario para el editor. `preview` repite el hex de resources/css/public.css
 * porque el panel de ajustes vive fuera de `.public-scope` y allí las variables
 * `--pub-*` no existen.
 */
export const PALETTE_SWATCHES: { value: string; label: string; preview: string }[] = [
    { value: 'bg', label: 'Fondo', preview: '#161826' },
    { value: 'surface', label: 'Superficie', preview: '#232532' },
    { value: 'band', label: 'Banda', preview: '#262a60' },
    { value: 'accent_fill', label: 'Acento suave', preview: '#423a6a' },
    { value: 'accent', label: 'Acento', preview: '#9184d9' },
    { value: 'black', label: 'Profundo', preview: '#0c0d15' },
];

/** Devuelve el color CSS de un token del lenguaje o de un hex; null si no vale. */
export function colorValue(value: unknown): string | null {
    const s = str(value).trim();
    if (!s) return null;
    if (PALETTE[s]) return PALETTE[s];

    return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s : null;
}

const POSITION: Record<string, string> = {
    center: 'center',
    top: 'center top',
    bottom: 'center bottom',
    left: 'left center',
    right: 'right center',
};

/* --------------------------------------------------------------- animación */

/** Punto de partida de la animación: de dónde entra cada pieza. */
const ANIM_FROM: Record<string, string> = {
    none: 'none',
    fade: 'none',
    up: 'translate3d(0, 26px, 0)',
    down: 'translate3d(0, -26px, 0)',
    left: 'translate3d(34px, 0, 0)',
    right: 'translate3d(-34px, 0, 0)',
    zoom: 'scale(0.94)',
    zoom_out: 'scale(1.06)',
    blur: 'none',
    rise: 'translate3d(0, 34px, 0) scale(0.97)',
};

const SPEED: Record<string, string> = {
    fast: '0.35s',
    normal: '0.6s',
    slow: '0.95s',
};

const STAGGER: Record<string, string> = {
    none: '0s',
    subtle: '0.05s',
    normal: '0.09s',
    wide: '0.16s',
};

/** Cuánto se desplaza el fondo respecto al scroll, en px por pantalla recorrida. */
const PARALLAX: Record<string, number> = {
    none: 0,
    soft: 40,
    medium: 80,
    strong: 130,
};

export const parallaxFactor = (a: Appearance): number => PARALLAX[a.parallax] ?? 0;

export const animates = (a: Appearance): boolean => a.anim !== 'none' && a.anim !== '';

/* ------------------------------------------------------------------ salida */

/** Variables CSS del contenedor: las lee `.pub-block` en resources/css/public.css. */
export function shellStyle(a: Appearance): CSSProperties {
    const vars: Record<string, string> = {
        '--pub-block-min': HEIGHT[a.height] ?? HEIGHT.auto,
        '--pub-block-align': ALIGN[a.align] ?? ALIGN.start,
        '--pub-block-max': WIDTH[a.width] ?? WIDTH.normal,
        '--pub-block-pt': PAD[a.pad_top] ?? PAD.md,
        '--pub-block-pb': PAD[a.pad_bottom] ?? PAD.md,
    };

    if (animates(a)) {
        vars['--pub-rev-from'] = ANIM_FROM[a.anim] ?? 'none';
        vars['--pub-rev-dur'] = SPEED[a.anim_speed] ?? SPEED.normal;
        vars['--pub-rev-step'] = STAGGER[a.anim_stagger] ?? STAGGER.normal;
        vars['--pub-rev-delay'] = `${Math.max(0, a.anim_delay) / 1000}s`;
        vars['--pub-rev-blur'] = a.anim === 'blur' ? '12px' : '0px';
    }

    return vars as CSSProperties;
}

/** Estilo de la capa de fondo, según el tipo elegido. Null si el bloque no lleva. */
export function backgroundStyle(a: Appearance): CSSProperties | null {
    if (a.bg_type === 'color') {
        const color = colorValue(a.bg_color);

        return color ? { backgroundColor: color } : null;
    }

    if (a.bg_type !== 'image' || !a.bg_image) {
        return null;
    }

    const repeat = a.bg_fit === 'repeat';

    return {
        backgroundImage: `url(${JSON.stringify(a.bg_image)})`,
        backgroundSize: repeat ? 'auto' : a.bg_fit === 'contain' ? 'contain' : 'cover',
        backgroundRepeat: repeat ? 'repeat' : 'no-repeat',
        backgroundPosition: POSITION[a.bg_position] ?? 'center',
        // `fixed` deja el fondo quieto sin JavaScript; el paralaje por scroll es
        // aparte y no se combinan.
        backgroundAttachment: a.bg_fixed && !parallaxFactor(a) ? 'fixed' : undefined,
        filter: a.bg_blur > 0 ? `blur(${a.bg_blur}px)` : undefined,
        // El desenfoque aclara los bordes: se agranda un poco para taparlos.
        transform: a.bg_blur > 0 ? 'scale(1.08)' : undefined,
    };
}

/** Velo sobre el fondo, para que el texto siga legible encima de una foto. */
export function overlayStyle(a: Appearance): CSSProperties | null {
    if (a.overlay <= 0) return null;

    return {
        backgroundColor: 'var(--pub-bg)',
        opacity: Math.min(100, a.overlay) / 100,
    };
}
