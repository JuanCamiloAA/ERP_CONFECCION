import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import * as HeroIcons from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { PlanInquiryModal, type PlanInquirySelection } from '@/Components/Landing/PlanInquiryModal';
import { cn } from '@/lib/utils';

interface Globals {
    site_name: string | null;
    meta_title: string | null;
    meta_description: string | null;
    header_logo_url?: string | null;
    navbar_cta_text: string | null;
    navbar_cta_url: string | null;
    footer_privacy_url: string | null;
    footer_terms_url: string | null;
    footer_contact_url: string | null;
    footer_legal_text: string | null;
    favicon_url?: string | null;
    plan_inquiry_notify_email?: string | null;
}

interface SectionRow {
    slug: string;
    title_internal: string;
    sort_order: number;
    payload: Record<string, unknown> | null;
}

interface Props {
    globals: Globals;
    sections: SectionRow[];
    appName: string;
}

function clampBannerOverlayPct(raw: unknown, whenMissing: number): number {
    const n = Number(raw ?? whenMissing);
    if (!Number.isFinite(n)) {
        return whenMissing;
    }
    return Math.min(100, Math.max(0, Math.round(n)));
}

function useLightTextOnBanner(overlayPct: number, hasBannerImage: boolean): boolean {
    return overlayPct >= 36 || (hasBannerImage && overlayPct >= 12);
}

function SectionBannerLayers({ imageUrl, overlayPct }: { imageUrl?: string | null; overlayPct: number }) {
    const hasOverlay = overlayPct > 0;
    const hasImage = Boolean(imageUrl);
    if (!hasImage && !hasOverlay) {
        return null;
    }
    return (
        <>
            {hasImage ? <img src={imageUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            {hasOverlay ? (
                <div className="absolute inset-0 bg-slate-950" style={{ opacity: overlayPct / 100 }} aria-hidden />
            ) : null}
        </>
    );
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
    const Cmp = (HeroIcons as Record<string, typeof HeroIcons.SparklesIcon>)[name] ?? HeroIcons.SparklesIcon;
    return <Cmp className={className ?? 'h-8 w-8 text-indigo-600'} />;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const hashClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (!href.startsWith('#') || href === '#' || href === '# ') {
            return;
        }
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.history.replaceState(null, '', href);
        }
    };

    if (href.startsWith('/') && !href.startsWith('//')) {
        return (
            <Link href={href} className="text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400">
                {children}
            </Link>
        );
    }
    return (
        <a
            href={href}
            onClick={hashClick}
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
        >
            {children}
        </a>
    );
}

function CtaButton({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
    const base =
        variant === 'primary'
            ? 'inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500'
            : 'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
    if (href.startsWith('/') && !href.startsWith('//')) {
        return (
            <Link href={href} className={base}>
                {children}
            </Link>
        );
    }
    return (
        <a href={href} className={base}>
            {children}
        </a>
    );
}

function ContactCtaButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
            {children}
        </button>
    );
}

export default function LandingPublic({ globals, sections, appName }: Props) {
    const page = usePage<App.PageProps>();
    const authUser = page.props.auth?.user ?? null;
    const flash = page.props.flash;
    const displayName = globals.site_name || appName;

    const [planInquiryOpen, setPlanInquiryOpen] = useState(false);
    const [planInquiryPlan, setPlanInquiryPlan] = useState<PlanInquirySelection | null>(null);

    const openPlanInquiry = (plan?: PlanInquirySelection | null) => {
        setPlanInquiryPlan(plan ?? null);
        setPlanInquiryOpen(true);
    };

    const metaTitle = globals.meta_title || displayName;
    const metaDesc = globals.meta_description || '';

    useEffect(() => {
        const hash = window.location.hash;
        if (hash.length > 1) {
            const id = hash.slice(1);
            const el = document.getElementById(id);
            if (el) {
                requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }
        }
    }, []);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <Head title={metaTitle}>
                <meta name="description" content={metaDesc} />
                {globals.favicon_url ? <link rel="icon" href={globals.favicon_url} /> : null}
            </Head>

            {authUser?.is_super_admin ? (
                <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
                    <span className="font-medium">Modo super administrador</span>
                    {' · '}
                    <Link href={route('dashboard')} className="font-semibold underline underline-offset-2">
                        Ir al panel
                    </Link>
                    {' · '}
                    <Link href={route('super-admin.landing.index')} className="font-semibold underline underline-offset-2">
                        Editor landing
                    </Link>
                </div>
            ) : null}

            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
                    <Link href={route('landing')} className="flex items-center gap-2">
                        {globals.header_logo_url ? (
                            <img src={globals.header_logo_url} alt="" className="h-10 w-auto max-w-[180px] object-contain" />
                        ) : (
                            <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{displayName}</span>
                        )}
                    </Link>
                    <nav className="hidden items-center gap-6 md:flex">
                        <NavLink href="#features">Capacidades</NavLink>
                        <NavLink href="#membership-plans">Planes</NavLink>
                        <NavLink href="#partners">Clientes</NavLink>
                        <NavLink href="#about">Nosotros</NavLink>
                        {globals.navbar_cta_text && globals.navbar_cta_url ? (
                            <CtaButton href={globals.navbar_cta_url} variant="secondary">
                                {globals.navbar_cta_text}
                            </CtaButton>
                        ) : null}
                        <ContactCtaButton onClick={() => openPlanInquiry()}>Solicitar acceso</ContactCtaButton>
                    </nav>
                    <div className="md:hidden">
                        <ContactCtaButton onClick={() => openPlanInquiry()}>Solicitar acceso</ContactCtaButton>
                    </div>
                </div>
            </header>

            <main>
                {sections.map((s) => (
                    <SectionBlock key={s.slug} slug={s.slug} payload={s.payload} onOpenPlanInquiry={openPlanInquiry} />
                ))}
            </main>

            <PlanInquiryModal
                open={planInquiryOpen}
                onClose={() => setPlanInquiryOpen(false)}
                plan={planInquiryPlan}
                mailtoTarget={globals.plan_inquiry_notify_email ?? null}
            />

            <footer className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-slate-600 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
                    <p className="max-w-xl whitespace-pre-wrap">{globals.footer_legal_text}</p>
                    <div className="flex flex-wrap gap-4">
                        {globals.footer_privacy_url ? (
                            <NavLink href={globals.footer_privacy_url}>Privacidad</NavLink>
                        ) : null}
                        {globals.footer_terms_url ? (
                            <NavLink href={globals.footer_terms_url}>Terminos</NavLink>
                        ) : null}
                        {globals.footer_contact_url ? (
                            <NavLink href={globals.footer_contact_url}>Contacto</NavLink>
                        ) : null}
                    </div>
                </div>
            </footer>
        </div>
    );
}

type PartnerItem = { name?: string; logo_url?: string; url?: string; sort?: number };

function PartnerLogoCard({ it }: { it: PartnerItem }) {
    return (
        <a
            href={it.url || '#'}
            className="flex min-w-[160px] shrink-0 flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800"
        >
            {it.logo_url ? (
                <img src={it.logo_url} alt="" className="h-12 w-full max-w-[140px] object-contain" />
            ) : (
                <div className="h-12 w-24 rounded bg-slate-200 dark:bg-slate-600" />
            )}
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{it.name}</span>
        </a>
    );
}

function PartnersStrip({ items }: { items: PartnerItem[] }) {
    const outerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [overflows, setOverflows] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

    const itemsSignature = items
        .map(
            (it, i) =>
                `${i}:${it.sort ?? ''}:${it.name ?? ''}:${it.logo_url ?? ''}:${it.url ?? ''}`,
        )
        .join('|');

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReduceMotion(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    useEffect(() => {
        const outer = outerRef.current;
        const measure = measureRef.current;
        if (!outer || !measure || items.length === 0) {
            setOverflows(false);
            return;
        }

        const update = () => {
            setOverflows(measure.scrollWidth > outer.clientWidth + 1);
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        ro.observe(measure);
        window.addEventListener('resize', update);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [items.length, itemsSignature]);

    const useMarquee = overflows && !reduceMotion;

    const marqueeSeconds = Math.min(90, Math.max(22, items.length * 5));
    const loopKeys = items.map((it, i) => `${i}-${it.name ?? ''}-${it.logo_url ?? ''}-${it.url ?? ''}`);

    return (
        <div ref={outerRef} className="relative w-full min-w-0">
            <div
                ref={measureRef}
                className="pointer-events-none absolute -left-[9999px] top-0 flex w-max shrink-0 gap-6"
                aria-hidden
            >
                {items.map((it, idx) => (
                    <PartnerLogoCard key={loopKeys[idx] ?? idx} it={it} />
                ))}
            </div>

            {useMarquee ? (
                <div className="group relative overflow-hidden">
                    <div
                        className="animate-partners-marquee flex w-max gap-6 hover:[animation-play-state:paused]"
                        style={{ ['--partners-marquee-seconds' as string]: `${marqueeSeconds}s` }}
                    >
                        {[...items, ...items].map((it, idx) => (
                            <PartnerLogoCard key={`marq-${idx}-${loopKeys[idx % items.length] ?? idx}`} it={it} />
                        ))}
                    </div>
                </div>
            ) : overflows && reduceMotion ? (
                <div className="scrollbar-thin flex flex-nowrap justify-start gap-6 overflow-x-auto pb-2 md:justify-center">
                    {items.map((it, idx) => (
                        <PartnerLogoCard key={loopKeys[idx] ?? idx} it={it} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-nowrap justify-center gap-6">
                    {items.map((it, idx) => (
                        <PartnerLogoCard key={loopKeys[idx] ?? idx} it={it} />
                    ))}
                </div>
            )}
        </div>
    );
}

function formatStaffCapLabel(n: unknown): string {
    if (n == null) return 'Usuarios de escritorio: ilimitados';
    return `Hasta ${n} usuarios de escritorio (staff)`;
}

function formatEmployeeCapLabel(n: unknown): string {
    if (n == null) return 'Empleados en nómina: ilimitados';
    return `Hasta ${n} empleados en nómina`;
}

function formatPlanMonthlyPrice(price: unknown): string {
    const p = typeof price === 'number' ? price : Number(price);
    if (!Number.isFinite(p) || p < 0) return 'Consultar precio';
    if (p === 0) return 'Consultar precio';
    return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: p % 1 !== 0 ? 2 : 0 }).format(p)} / mes`;
}

function SectionBlock({
    slug,
    payload,
    onOpenPlanInquiry,
}: {
    slug: string;
    payload: Record<string, unknown> | null;
    onOpenPlanInquiry: (plan?: PlanInquirySelection | null) => void;
}) {
    if (!payload) return null;

    if (slug === 'hero') {
        const p = payload as {
            headline?: string;
            subtext?: string;
            primary_cta_text?: string;
            primary_cta_url?: string;
            secondary_cta_text?: string;
            secondary_cta_url?: string;
            background_image_url?: string;
            background_image_alt?: string;
            banner_overlay_opacity?: number;
        };
        const hasBgImage = Boolean(p.background_image_url);
        const overlayPct = clampBannerOverlayPct(p.banner_overlay_opacity, hasBgImage ? 72 : 0);

        return (
            <section className="relative overflow-hidden">
                {hasBgImage ? (
                    <>
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${p.background_image_url})` }}
                        />
                        <div
                            className="absolute inset-0 bg-slate-950"
                            style={{ opacity: overlayPct / 100 }}
                            aria-hidden
                        />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/75 via-slate-900/50 to-slate-900/80" aria-hidden />
                )}
                <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-24 md:py-32">
                    <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">{p.headline}</h1>
                    <p className="max-w-2xl text-lg text-slate-100/95">{p.subtext}</p>
                    <div className="flex flex-wrap gap-3">
                        {p.primary_cta_text ? (
                            <ContactCtaButton onClick={() => onOpenPlanInquiry()}>{p.primary_cta_text}</ContactCtaButton>
                        ) : null}
                        {p.secondary_cta_text && p.secondary_cta_url ? (
                            <CtaButton href={p.secondary_cta_url} variant="secondary">
                                {p.secondary_cta_text}
                            </CtaButton>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    if (slug === 'features') {
        const p = payload as {
            items?: { icon?: string; title?: string; description?: string }[];
            banner_image_url?: string;
            banner_overlay_opacity?: number;
        };
        const items = p.items ?? [];
        const overlayPct = clampBannerOverlayPct(p.banner_overlay_opacity, 0);
        const bannerImageUrl = p.banner_image_url;
        const useLightHeading = useLightTextOnBanner(overlayPct, Boolean(bannerImageUrl));

        return (
            <section id="features" className="relative scroll-mt-24 overflow-hidden py-16 md:py-24">
                <SectionBannerLayers imageUrl={bannerImageUrl} overlayPct={overlayPct} />
                <div className="relative z-10 mx-auto max-w-6xl px-4">
                    <h2
                        className={
                            useLightHeading
                                ? 'mb-10 text-center text-3xl font-bold text-white drop-shadow-sm'
                                : 'mb-10 text-center text-3xl font-bold text-slate-900 dark:text-slate-100'
                        }
                    >
                        Capacidades
                    </h2>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((it, idx) => (
                            <div
                                key={idx}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
                            >
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/40">
                                    <DynamicIcon name={it.icon ?? 'SparklesIcon'} className="h-7 w-7 text-indigo-600 dark:text-indigo-300" />
                                </div>
                                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{it.title}</h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{it.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (slug === 'membership_plans') {
        const p = payload as {
            title?: string;
            subtitle?: string;
            footnote?: string;
            banner_image_url?: string;
            banner_overlay_opacity?: number;
            plans?: {
                id: number;
                name: string;
                slug: string;
                max_staff_users: number | null;
                max_employees: number | null;
                features_json: string[] | null;
                price_monthly: number | null;
            }[];
        };
        const overlayPct = clampBannerOverlayPct(p.banner_overlay_opacity, 0);
        const bannerImageUrl = p.banner_image_url;
        const hasBannerLayers = overlayPct > 0 || Boolean(bannerImageUrl);
        const useLightText = useLightTextOnBanner(overlayPct, Boolean(bannerImageUrl));
        const plans = p.plans ?? [];

        return (
            <section
                id="membership-plans"
                className={`scroll-mt-24 py-16 md:py-20 ${hasBannerLayers ? 'relative overflow-hidden' : 'bg-slate-100 dark:bg-slate-950'}`}
            >
                <SectionBannerLayers imageUrl={bannerImageUrl} overlayPct={overlayPct} />
                <div className="relative z-10 mx-auto max-w-6xl px-4">
                    <h2
                        className={
                            useLightText
                                ? 'text-center text-3xl font-bold text-white drop-shadow-sm'
                                : 'text-center text-3xl font-bold text-slate-900 dark:text-slate-100'
                        }
                    >
                        {p.title ?? 'Planes de membresía'}
                    </h2>
                    {p.subtitle ? (
                        <p
                            className={
                                useLightText
                                    ? 'mx-auto mt-3 max-w-2xl text-center text-slate-200'
                                    : 'mx-auto mt-3 max-w-2xl text-center text-slate-600 dark:text-slate-300'
                            }
                        >
                            {p.subtitle}
                        </p>
                    ) : null}

                    {plans.length === 0 ? (
                        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
                            No hay planes activos configurados en el sistema.
                        </p>
                    ) : (
                        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {plans.map((plan) => {
                                const feats = Array.isArray(plan.features_json) ? plan.features_json : [];
                                return (
                                    <div
                                        key={plan.id}
                                        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/80"
                                    >
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
                                        <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                            {formatPlanMonthlyPrice(plan.price_monthly ?? null)}
                                        </p>
                                        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                            <li className="flex gap-2">
                                                <span className="font-medium text-indigo-600 dark:text-indigo-400">·</span>
                                                {formatStaffCapLabel(plan.max_staff_users)}
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-medium text-indigo-600 dark:text-indigo-400">·</span>
                                                {formatEmployeeCapLabel(plan.max_employees)}
                                            </li>
                                            {feats.map((line, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="font-medium text-indigo-600 dark:text-indigo-400">·</span>
                                                    <span>{line}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="mt-6 flex flex-wrap gap-2">
                                            <ContactCtaButton onClick={() => onOpenPlanInquiry({ id: plan.id, name: plan.name })}>
                                                Solicitar este plan
                                            </ContactCtaButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {p.footnote ? (
                        <p
                            className={
                                useLightText
                                    ? 'mt-10 text-center text-sm text-slate-300'
                                    : 'mt-10 text-center text-sm text-slate-500 dark:text-slate-400'
                            }
                        >
                            {p.footnote}
                        </p>
                    ) : null}
                </div>
            </section>
        );
    }

    if (slug === 'partners') {
        const p = payload as {
            items?: { name?: string; logo_url?: string; url?: string; sort?: number }[];
            banner_image_url?: string;
            banner_overlay_opacity?: number;
        };
        const raw = p.items ?? [];
        const items = [...raw].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
        const overlayPct = clampBannerOverlayPct(p.banner_overlay_opacity, 0);
        const bannerImageUrl = p.banner_image_url;
        const hasBannerLayers = overlayPct > 0 || Boolean(bannerImageUrl);
        const useLightHeading = useLightTextOnBanner(overlayPct, Boolean(bannerImageUrl));

        return (
            <section
                id="partners"
                className={`scroll-mt-24 py-16 ${hasBannerLayers ? 'relative overflow-hidden' : 'bg-white dark:bg-slate-900'}`}
            >
                <SectionBannerLayers imageUrl={bannerImageUrl} overlayPct={overlayPct} />
                <div className="relative z-10 mx-auto max-w-6xl px-4">
                    <h2
                        className={
                            useLightHeading
                                ? 'mb-10 text-center text-3xl font-bold text-white drop-shadow-sm'
                                : 'mb-10 text-center text-3xl font-bold text-slate-900 dark:text-white'
                        }
                    >
                        Clientes y aliados
                    </h2>
                    {items.length > 0 ? <PartnersStrip items={items} /> : null}
                </div>
            </section>
        );
    }

    if (slug === 'about') {
        const p = payload as {
            title?: string;
            body?: string;
            image_url?: string;
            banner_image_url?: string;
            banner_overlay_opacity?: number;
        };
        const overlayPct = clampBannerOverlayPct(p.banner_overlay_opacity, 0);
        const bannerImageUrl = p.banner_image_url;
        const hasBannerLayers = overlayPct > 0 || Boolean(bannerImageUrl);
        const useLightText = useLightTextOnBanner(overlayPct, Boolean(bannerImageUrl));

        return (
            <section
                id="about"
                className={`scroll-mt-24 py-16 md:py-24 ${hasBannerLayers ? 'relative overflow-hidden' : ''}`}
            >
                <SectionBannerLayers imageUrl={bannerImageUrl} overlayPct={overlayPct} />
                <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
                    <div>
                        <h2
                            className={
                                useLightText
                                    ? 'mb-4 text-3xl font-bold text-white drop-shadow-sm'
                                    : 'mb-4 text-3xl font-bold text-slate-900 dark:text-white'
                            }
                        >
                            {p.title}
                        </h2>
                        <p
                            className={
                                useLightText
                                    ? 'whitespace-pre-wrap text-slate-200'
                                    : 'whitespace-pre-wrap text-slate-600 dark:text-slate-300'
                            }
                        >
                            {p.body}
                        </p>
                    </div>
                    {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full rounded-2xl shadow-lg ring  ring-slate-200/60 dark:ring-slate-700" />
                    ) : null}
                </div>
            </section>
        );
    }

    const custom = payload as {
        title?: string;
        subtitle?: string;
        body_markdown?: string;
        banner_image_url?: string;
        banner_overlay_opacity?: number;
        content_image_url?: string;
        primary_cta_text?: string;
        primary_cta_url?: string;
        secondary_cta_text?: string;
        secondary_cta_url?: string;
        text_align?: string;
    };
    const overlayPct = clampBannerOverlayPct(custom.banner_overlay_opacity, 0);
    const bannerImageUrl = custom.banner_image_url;
    const hasBannerLayers = overlayPct > 0 || Boolean(bannerImageUrl);
    const useLightText = useLightTextOnBanner(overlayPct, Boolean(bannerImageUrl));
    const alignCenter = custom.text_align === 'center';
    const contentImageUrl = custom.content_image_url;
    const hasContentSplit = Boolean(contentImageUrl);

    return (
        <section
            id={`section-${slug}`}
            className={
                hasBannerLayers
                    ? 'relative overflow-hidden py-14'
                    : 'border-t border-slate-200 bg-slate-100 py-14 dark:border-slate-800 dark:bg-slate-950'
            }
        >
            <SectionBannerLayers imageUrl={bannerImageUrl} overlayPct={overlayPct} />
            <div
                className={cn(
                    'relative z-10 mx-auto max-w-6xl px-4',
                    alignCenter ? 'text-center' : 'text-left',
                )}
            >
                <h2
                    className={
                        useLightText
                            ? 'text-2xl font-bold text-white drop-shadow-sm md:text-3xl'
                            : 'text-2xl font-bold text-slate-900 dark:text-white md:text-3xl'
                    }
                >
                    {custom.title}
                </h2>
                {custom.subtitle ? (
                    <p
                        className={cn(
                            'mt-2 text-lg',
                            useLightText ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300',
                        )}
                    >
                        {custom.subtitle}
                    </p>
                ) : null}
                <div
                    className={cn(
                        'mt-6',
                        hasContentSplit ? 'grid items-center gap-8 md:grid-cols-2' : '',
                        hasContentSplit && alignCenter ? 'md:text-left' : '',
                    )}
                >
                    <div>
                        <div
                            className={
                                useLightText
                                    ? 'whitespace-pre-wrap text-slate-200'
                                    : 'whitespace-pre-wrap text-slate-700 dark:text-slate-300'
                            }
                        >
                            {custom.body_markdown}
                        </div>
                        <div
                            className={cn(
                                'mt-6 flex flex-wrap gap-3',
                                alignCenter && !hasContentSplit ? 'justify-center' : 'justify-start',
                            )}
                        >
                            {custom.primary_cta_text && custom.primary_cta_url ? (
                                <CtaButton href={custom.primary_cta_url}>{custom.primary_cta_text}</CtaButton>
                            ) : null}
                            {custom.secondary_cta_text && custom.secondary_cta_url ? (
                                <CtaButton href={custom.secondary_cta_url} variant="secondary">
                                    {custom.secondary_cta_text}
                                </CtaButton>
                            ) : null}
                        </div>
                    </div>
                    {contentImageUrl ? (
                        <img
                            src={contentImageUrl}
                            alt=""
                            className="w-full rounded-2xl shadow-lg ring ring-slate-200/60 dark:ring-slate-700"
                        />
                    ) : null}
                </div>
            </div>
        </section>
    );
}
