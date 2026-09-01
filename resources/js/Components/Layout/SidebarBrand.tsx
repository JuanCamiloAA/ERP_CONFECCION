import { Link } from '@inertiajs/react';
import { BrandMark, type BrandLogo } from '@/Components/BrandMark';
import { cn } from '@/lib/utils';

interface Props {
    href: string;
    title: string;
    /** Plan de membresía o etiqueta secundaria. */
    subtitle?: string | null;
    logoUrl: string | null;
    brandLogo?: BrandLogo | null;
    /** Solo el logo, centrado. */
    compact?: boolean;
    className?: string;
}

/**
 * Marca del sidebar: logo de la empresa activa y su plan.
 *
 * El plan va debajo del nombre y no en el navbar porque es un dato de contexto, no de
 * navegación: se consulta de vez en cuando y no debe competir por el espacio de la cabecera.
 */
export function SidebarBrand({ href, title, subtitle, logoUrl, brandLogo, compact = false, className }: Props) {
    return (
        <Link
            href={href}
            title={title}
            className={cn(
                'flex items-center gap-2.5 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
                compact && 'justify-center',
                className,
            )}
        >
            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg border border-slate-200/80 bg-white object-contain p-0.5 dark:border-slate-600/80 dark:bg-slate-900/40"
                />
            ) : (
                <BrandMark
                    logo={brandLogo}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-indigo-600 dark:border-slate-600/80 dark:bg-slate-900/40 dark:text-indigo-400"
                    imageClassName="h-8 w-8 shrink-0 rounded-lg border border-slate-200/80 bg-white p-0.5 dark:border-slate-600/80 dark:bg-slate-900/40"
                    size={18}
                />
            )}

            {! compact ? (
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                    </span>
                    {subtitle ? (
                        <span className="block truncate text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {subtitle}
                        </span>
                    ) : null}
                </span>
            ) : null}
        </Link>
    );
}

export default SidebarBrand;
