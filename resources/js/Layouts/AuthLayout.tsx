import { Link, usePage } from '@inertiajs/react';
import { ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { BrandMark } from '@/Components/BrandMark';
import '../../css/public.css';

interface AuthLayoutProps {
    children: ReactNode;
    title?: string;
    description?: string;
    /** Titular del panel izquierdo; cada pantalla de acceso puede matizarlo. */
    heading?: string;
    subheading?: string;
}

/**
 * Fondo «urdimbre y trama»: cuatro capas de degradados, sin una sola imagen que cargar.
 *
 * Las dos tramas usan frecuencias distintas (7px y 11px) a proposito: cruzadas dan la
 * textura de un tejido visto de cerca. Las mascaras comparten angulo (200deg) con
 * umbrales distintos, de modo que el tejido se tupe hacia la esquina inferior izquierda
 * y se apaga arriba a la derecha.
 *
 * `panel` es la columna de escritorio; `band` la franja superior del movil, con el mismo
 * lenguaje pero mas compacta.
 */
function Weave({ variant }: { variant: 'panel' | 'band' }) {
    const esPanel = variant === 'panel';

    return (
        <>
            {/* 1. Bano de acento en diagonal */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                    background: esPanel
                        ? 'linear-gradient(155deg, rgba(145,132,217,.16), transparent 46%, rgba(145,132,217,.10))'
                        : 'linear-gradient(165deg, rgba(145,132,217,.16), transparent 46%, rgba(145,132,217,.10))',
                }}
            />

            {/* 2. Urdimbre: verticales finas cada 7px, neutras */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, rgba(233,233,237,.13) 0 1px, transparent 1px 7px)',
                    maskImage: `linear-gradient(200deg, transparent ${esPanel ? '18%' : '20%'}, #000 ${esPanel ? '96%' : '98%'})`,
                    WebkitMaskImage: `linear-gradient(200deg, transparent ${esPanel ? '18%' : '20%'}, #000 ${esPanel ? '96%' : '98%'})`,
                }}
            />

            {/* 3. Trama: horizontales cada 11px, en el acento */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(145,132,217,.20) 0 1px, transparent 1px 11px)',
                    maskImage: `linear-gradient(200deg, transparent ${esPanel ? '30%' : '34%'}, #000 100%)`,
                    WebkitMaskImage: `linear-gradient(200deg, transparent ${esPanel ? '30%' : '34%'}, #000 100%)`,
                }}
            />

            {/* 4. Resplandor de la esquina inferior izquierda */}
            <div
                className={
                    esPanel
                        ? 'pointer-events-none absolute -bottom-[220px] -left-[140px] h-[600px] w-[600px] rounded-full'
                        : 'pointer-events-none absolute -bottom-[190px] -left-[110px] h-[440px] w-[440px] rounded-full'
                }
                aria-hidden="true"
                style={{ background: 'radial-gradient(circle, rgba(145,132,217,.22), transparent 66%)' }}
            />
        </>
    );
}

/**
 * Shell de las pantallas de acceso, con el lenguaje visual publico (oscuro + acento).
 * Deliberadamente NO comparte estilos con AppLayout: el interior de la aplicacion
 * mantiene su tema slate/indigo. Los tokens viven en resources/css/public.css.
 */
export default function AuthLayout({
    children,
    title,
    description,
    heading = 'El turno de hoy ya está contando.',
    subheading = 'Entra para registrar producción, revisar jornadas y cerrar la quincena.',
}: AuthLayoutProps) {
    const page = usePage();
    const flash = (page.props as unknown as App.PageProps).flash;
    const appName = (page.props as unknown as App.PageProps).appName;
    const loginCompany = (page.props as unknown as App.PageProps).loginCompany;
    const brandLogo = (page.props as unknown as App.PageProps).brandLogo;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning) toast.warning(flash.warning);
        if (flash?.info) toast.info(flash.info);
    }, [flash]);

    // El cuadro lleva el fondo opaco del tema para que la trama no se lea por detras.
    const cajaMarca = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm lg:h-[34px] lg:w-[34px]';
    const estiloCaja = {
        border: '1px solid var(--pub-accent)',
        color: 'var(--pub-accent)',
        backgroundColor: 'var(--pub-bg)',
    };

    // Cuando se entra por el enlace de una empresa, esa marca manda sobre la del producto.
    const brand = loginCompany ? (
        <div className="flex items-center gap-3">
            {loginCompany.logo_url ? (
                <img
                    src={loginCompany.logo_url}
                    alt={loginCompany.name}
                    className={`${cajaMarca} object-contain p-0.5`}
                    style={estiloCaja}
                />
            ) : (
                <span className={`${cajaMarca} text-[15px]`} style={estiloCaja}>
                    {loginCompany.name.charAt(0).toUpperCase()}
                </span>
            )}
            <span className="text-[15px] font-medium lg:text-base" style={{ color: 'var(--pub-text)' }}>
                {loginCompany.name}
            </span>
        </div>
    ) : (
        // Marca del producto: la que se elige en el editor de la landing. No el PNG de
        // marca, que es oscuro sobre oscuro y aqui se leeria como un cuadro vacio.
        <Link href="/" className="flex min-h-11 items-center gap-3">
            <BrandMark logo={brandLogo} className={cajaMarca} imageClassName={`${cajaMarca} p-0.5`} style={estiloCaja} size={18} />
            <span className="text-[15px] font-medium lg:text-base" style={{ color: 'var(--pub-text)' }}>
                {appName}
            </span>
        </Link>
    );

    const copyright = (
        <p className="text-xs" style={{ color: 'var(--pub-gray-3)' }}>
            &copy; {new Date().getFullYear()} {appName}
        </p>
    );

    return (
        <div className="public-scope min-h-screen">
            <div className="flex min-h-screen w-full flex-col lg:grid lg:grid-cols-[1.12fr_1fr] lg:items-stretch">
                {/*
                 * Panel izquierdo en escritorio, franja superior en movil. Las capas del
                 * fondo van absolutas, asi que el contenido necesita `relative` para
                 * quedar por encima.
                 */}
                <section className="relative shrink-0 overflow-hidden border-b border-(--pub-divider) px-5 pt-6 pb-6 lg:flex lg:shrink lg:flex-col lg:border-b-0 lg:border-r lg:p-9">
                    {/* Mismas cuatro capas, calibradas distinto para la franja movil. */}
                    <div className="pointer-events-none absolute inset-0 lg:hidden">
                        <Weave variant="band" />
                    </div>
                    <div className="pointer-events-none absolute inset-0 hidden lg:block">
                        <Weave variant="panel" />
                    </div>

                    <div className="relative">{brand}</div>

                    {/* Centro vertical en escritorio; en movil sigue al hilo de la franja. */}
                    <div className="relative mt-6 lg:mt-auto lg:mb-auto lg:py-10">
                        <span
                            className="mb-4 block h-[2px] w-9"
                            style={{ backgroundColor: 'var(--pub-accent)' }}
                            aria-hidden="true"
                        />
                        <h2
                            className="max-w-[19ch] text-[27px] leading-[1.14] tracking-tight lg:text-[34px] lg:leading-[1.12]"
                            style={{ color: 'var(--pub-text)' }}
                        >
                            {heading}
                        </h2>
                        <p
                            className="mt-3 max-w-[34ch] text-sm leading-relaxed lg:text-[15px]"
                            style={{ color: 'var(--pub-gray-1)' }}
                        >
                            {subheading}
                        </p>
                    </div>

                    {/* El pie vive aqui; en movil se muestra al final del cuerpo. */}
                    <div className="relative hidden lg:block">{copyright}</div>
                </section>

                <section className="flex min-h-0 flex-1 flex-col px-5 py-5.5 lg:justify-center lg:px-8 lg:py-9">
                    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col lg:block lg:flex-none">
                        {title ? (
                            <h1 className="text-[22px] tracking-tight" style={{ color: 'var(--pub-text)' }}>
                                {title}
                            </h1>
                        ) : null}
                        {description ? (
                            <p className="mt-1 text-[13px]" style={{ color: 'var(--pub-gray-3)' }}>
                                {description}
                            </p>
                        ) : null}
                        <div className={`flex min-h-0 flex-1 flex-col lg:block ${title || description ? 'mt-5' : ''}`}>
                            {children}
                        </div>

                        {/* En movil el pie cierra el cuerpo; en escritorio vive en el panel izquierdo. */}
                        <div className="mt-6 lg:hidden">{copyright}</div>
                    </div>
                </section>
            </div>
        </div>
    );
}
