import { ArrowRight, Check, Image as ImageIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { phosphorIcon } from '@/Components/Public/phosphorIcon';

/**
 * Bloques de la landing publica. Todo el texto llega por `data` (contenido editable);
 * aqui no hay copy fijo salvo etiquetas de accesibilidad. Los colores salen de las
 * variables de resources/css/public.css, nunca hex sueltos.
 */

type Dict = Record<string, unknown>;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const list = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : []);

/**
 * Lista de textos. El catalogo guarda los repeaters como objetos {label}; se acepta
 * tambien el formato antiguo de cadenas sueltas para no romper contenido ya cargado.
 */
const labels = (v: unknown): string[] =>
    Array.isArray(v)
        ? v.map((x) => (typeof x === 'string' ? x : str((x as Dict)?.label))).filter(Boolean)
        : [];

/** Kicker: micro etiqueta en versalitas y color de acento. */
export function Kicker({ children }: { children: ReactNode }) {
    return (
        <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'var(--pub-accent)' }}
        >
            {children}
        </p>
    );
}

/** Cuadro de icono con borde de acento, usado en flujo y virtudes. */
function IconBox({ name, size = 18 }: { name: unknown; size?: number }) {
    const icon = phosphorIcon(typeof name === 'string' ? name : null, size);
    if (!icon) return null;

    return (
        <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{ border: '1px solid var(--pub-gray-6)', color: 'var(--pub-accent)' }}
        >
            {icon}
        </span>
    );
}

/** Enlace-boton delineado; `variant="quiet"` usa borde gris en vez de acento. */
function LinkButton({
    label,
    url,
    variant = 'accent',
    withArrow = false,
}: {
    label?: unknown;
    url?: unknown;
    variant?: 'accent' | 'quiet';
    withArrow?: boolean;
}) {
    const text = str(label);
    if (!text) return null;

    return (
        <a
            href={str(url, '#') || '#'}
            className={`pub-btn ${variant === 'quiet' ? 'pub-btn-quiet' : ''} h-11 px-4 text-sm`}
        >
            {text}
            {withArrow ? <ArrowRight size={16} /> : null}
        </a>
    );
}

/* ------------------------------------------------------------------ hero */

export function HeroBlock({ data, aside }: { data: Dict; aside?: ReactNode }) {
    const trust = labels(data.trust);

    // Acepta la forma nueva ({title, body, primary:{label,url}}) y la heredada del CMS
    // actual ({headline, subtext, primary_cta_text, primary_cta_url}), para que el
    // contenido ya cargado se vea con el diseno nuevo sin tener que migrarlo a mano.
    const title = str(data.title) || str(data.headline);
    const body = str(data.body) || str(data.subtext);
    const primary = (data.primary ?? {
        label: str(data.primary_cta_text),
        url: str(data.primary_cta_url),
    }) as Dict;
    const secondary = (data.secondary ?? {
        label: str(data.secondary_cta_text),
        url: str(data.secondary_cta_url),
    }) as Dict;

    return (
        <section className="relative overflow-hidden px-5 py-12 lg:px-10 lg:py-20">
            <span className="pub-glow -top-32 -left-24 h-96 w-96" aria-hidden="true" />
            <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-14">
                <div>
                    {str(data.tag) ? (
                        <span
                            className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px]"
                            style={{ border: '1px solid var(--pub-gray-6)', color: 'var(--pub-gray-1)' }}
                        >
                            {str(data.tag)}
                        </span>
                    ) : null}

                    <h1
                        className="mt-5 text-[32px] leading-[1.12] tracking-tight lg:text-[44px]"
                        style={{ color: 'var(--pub-text)' }}
                    >
                        {title}
                    </h1>

                    {body ? (
                        <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--pub-gray-2)' }}>
                            {body}
                        </p>
                    ) : null}

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <LinkButton label={primary.label} url={primary.url} withArrow />
                        <LinkButton label={secondary.label} url={secondary.url} variant="quiet" />
                    </div>

                    {trust.length > 0 ? (
                        <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
                            {trust.map((t, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--pub-gray-3)' }}>
                                    <Check size={14} style={{ color: 'var(--pub-accent)' }} />
                                    {String(t)}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                {aside ? <div className="relative">{aside}</div> : null}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ flow */

/** Tarjeta del flujo; en el diseno va al costado del hero. */
export function FlowBlock({ data }: { data: Dict }) {
    const steps = list(data.steps);

    return (
        <div>
            <div className="rounded-[14px] p-5" style={{ backgroundColor: 'var(--pub-surface)', boxShadow: 'var(--pub-elev-sm)' }}>
                {str(data.kicker) ? (
                    <>
                        <Kicker>{str(data.kicker)}</Kicker>
                        <hr className="pub-rule mt-3" />
                    </>
                ) : null}

                <ol className="mt-4 space-y-4">
                    {steps.map((step, i) => (
                        <li key={i} className="relative flex gap-3">
                            {/* Linea vertical que une los pasos, en degradado hacia transparente. */}
                            {i < steps.length - 1 ? (
                                <span
                                    className="absolute left-[17px] top-10 bottom-[-16px] w-px"
                                    style={{
                                        background:
                                            'linear-gradient(to bottom, var(--pub-accent), transparent)',
                                    }}
                                    aria-hidden="true"
                                />
                            ) : null}
                            <IconBox name={step.icon} />
                            <div className="min-w-0">
                                <p className="text-sm" style={{ color: 'var(--pub-text)' }}>
                                    {str(step.title)}
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--pub-gray-3)' }}>
                                    {str(step.body)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {str(data.caption) ? (
                <p className="mt-3 text-xs" style={{ color: 'var(--pub-accent)' }}>
                    {str(data.caption)}
                </p>
            ) : null}
        </div>
    );
}

/* ------------------------------------------------------------------ band */

/** Unica superficie saturada de toda la pagina. */
export function BandBlock({ data }: { data: Dict }) {
    const items = list(data.items);

    return (
        <section className="px-5 py-4 lg:px-10" style={{ backgroundColor: 'var(--pub-band)' }}>
            <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
                {str(data.title) ? (
                    <p className="shrink-0 text-sm" style={{ color: 'var(--pub-accent-on-band-soft)' }}>
                        {str(data.title)}
                    </p>
                ) : null}
                <ul className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-7">
                    {items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--pub-accent-on-band)' }}>
                            <span style={{ color: 'var(--pub-accent-on-band)' }}>{phosphorIcon(str(item.icon), 16)}</span>
                            {str(item.label)}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/* --------------------------------------------------------------- virtues */

export function VirtuesBlock({ data }: { data: Dict }) {
    const cards = list(data.cards);

    return (
        <section className="px-5 py-14 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-6xl">
                {str(data.kicker) ? <Kicker>{str(data.kicker)}</Kicker> : null}
                {str(data.title) ? (
                    <h2 className="mt-3 max-w-2xl text-[26px] leading-tight tracking-tight lg:text-[32px]" style={{ color: 'var(--pub-text)' }}>
                        {str(data.title)}
                    </h2>
                ) : null}

                <div className="mt-9 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card, i) => (
                        <div key={i}>
                            <IconBox name={card.icon} />
                            <p className="mt-3 text-[15px]" style={{ color: 'var(--pub-text)' }}>
                                {str(card.title)}
                            </p>
                            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--pub-gray-3)' }}>
                                {str(card.body)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------- audience */

export function AudienceBlock({ data }: { data: Dict }) {
    const roles = list(data.roles);

    return (
        <section className="px-5 py-14 lg:px-10 lg:py-20">
            <div className="mx-auto max-w-6xl">
                {str(data.kicker) ? <Kicker>{str(data.kicker)}</Kicker> : null}
                {str(data.title) ? (
                    <h2 className="mt-3 max-w-2xl text-[26px] leading-tight tracking-tight lg:text-[32px]" style={{ color: 'var(--pub-text)' }}>
                        {str(data.title)}
                    </h2>
                ) : null}

                <div className="mt-9 grid gap-4 lg:grid-cols-3">
                    {roles.map((role, i) => {
                        const points = labels(role.points);
                        return (
                            <div key={i} className="rounded-[14px] p-5" style={{ boxShadow: 'var(--pub-elev-sm)' }}>
                                {str(role.tag) ? (
                                    <span
                                        className="inline-flex items-center rounded-sm px-2 py-0.5 text-[11px]"
                                        style={{ backgroundColor: 'var(--pub-accent-fill)', color: 'var(--pub-accent-on-band-soft)' }}
                                    >
                                        {str(role.tag)}
                                    </span>
                                ) : null}
                                <p className="mt-3 text-[15px]" style={{ color: 'var(--pub-text)' }}>
                                    {str(role.title)}
                                </p>
                                <ul className="mt-3 space-y-1.5">
                                    {points.map((pt, j) => (
                                        <li key={j} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: 'var(--pub-gray-2)' }}>
                                            <span style={{ color: 'var(--pub-accent)' }}>—</span>
                                            {String(pt)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/* ----------------------------------------------------------- steps_media */

export function StepsMediaBlock({ data }: { data: Dict }) {
    const steps = list(data.steps);
    const image = str(data.image);

    return (
        <section className="px-5 py-14 lg:px-10 lg:py-20">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
                <div>
                    {str(data.kicker) ? <Kicker>{str(data.kicker)}</Kicker> : null}
                    <ol className="mt-6 space-y-6">
                        {steps.map((step, i) => (
                            <li key={i} className="flex gap-4">
                                <span className="shrink-0 text-sm tabular-nums" style={{ color: 'var(--pub-accent)' }}>
                                    {str(step.number)}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[15px]" style={{ color: 'var(--pub-text)' }}>
                                        {str(step.title)}
                                    </p>
                                    <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--pub-gray-3)' }}>
                                        {str(step.body)}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <div>
                    {/* Mientras no haya foto cargada, el marco con leyenda es el estado correcto. */}
                    <div
                        className="flex aspect-[4/3] items-center justify-center rounded-[14px] overflow-hidden"
                        style={{ boxShadow: 'var(--pub-elev-sm)', backgroundColor: 'var(--pub-surface)' }}
                    >
                        {image ? (
                            <img
                                src={image}
                                alt=""
                                className="h-full w-full object-cover"
                                style={{ mixBlendMode: 'lighten' }}
                            />
                        ) : (
                            <div className="px-8 text-center">
                                <ImageIcon size={26} style={{ color: 'var(--pub-gray-5)' }} className="mx-auto" />
                                <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--pub-gray-4)' }}>
                                    {str(data.image_caption)}
                                </p>
                            </div>
                        )}
                    </div>
                    {str(data.image_note) ? (
                        <p className="mt-2 text-[11px]" style={{ color: 'var(--pub-gray-5)' }}>
                            {str(data.image_note)}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

/* ----------------------------------------------------------------- quote */

export function QuoteBlock({ data }: { data: Dict }) {
    if (!str(data.text)) return null;

    return (
        <section className="px-5 py-14 lg:px-10 lg:py-20">
            <figure className="mx-auto max-w-3xl text-center">
                <blockquote className="text-[20px] leading-relaxed lg:text-[24px]" style={{ color: 'var(--pub-text)' }}>
                    {str(data.text)}
                </blockquote>
                {str(data.source) ? (
                    <figcaption className="mt-4 text-xs" style={{ color: 'var(--pub-gray-4)' }}>
                        {str(data.source)}
                    </figcaption>
                ) : null}
            </figure>
        </section>
    );
}

/* --------------------------------------------------------------- closing */

export function ClosingBlock({ data }: { data: Dict }) {
    const primary = (data.primary ?? {}) as Dict;
    const secondary = (data.secondary ?? {}) as Dict;

    return (
        <section className="px-5 pb-14 lg:px-10 lg:pb-20">
            <div
                className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[14px] p-6 lg:flex-row lg:items-center lg:justify-between lg:p-10"
                style={{ boxShadow: 'var(--pub-elev-sm)' }}
            >
                <div className="max-w-lg">
                    <h2 className="text-[24px] leading-tight tracking-tight lg:text-[28px]" style={{ color: 'var(--pub-text)' }}>
                        {str(data.title)}
                    </h2>
                    {str(data.body) ? (
                        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--pub-gray-2)' }}>
                            {str(data.body)}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-3">
                    <LinkButton label={primary.label} url={primary.url} withArrow />
                    <LinkButton label={secondary.label} url={secondary.url} variant="quiet" />
                </div>
            </div>
        </section>
    );
}
