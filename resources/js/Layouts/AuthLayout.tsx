import { Link, usePage } from '@inertiajs/react';
import { ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

interface AuthLayoutProps {
    children: ReactNode;
    title?: string;
    description?: string;
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
    const page = usePage();
    const flash = (page.props as unknown as App.PageProps).flash;
    const appName = (page.props as unknown as App.PageProps).appName;
    const brandIconUrl = (page.props as unknown as App.PageProps).brandIconUrl;
    const loginCompany = (page.props as unknown as App.PageProps).loginCompany;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
        if (flash?.warning) toast.warning(flash.warning);
        if (flash?.info) toast.info(flash.info);
    }, [flash]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="mb-8 text-center">
                        {loginCompany ? (
                            <div className="flex flex-col items-center gap-3">
                                {loginCompany.logo_url ? (
                                    <img
                                        src={loginCompany.logo_url}
                                        alt={loginCompany.name}
                                        className="h-20 w-20 rounded-2xl border border-slate-200/80 bg-white object-contain p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                                    />
                                ) : (
                                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-2xl font-bold text-white shadow-lg">
                                        {loginCompany.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{loginCompany.name}</p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Acceso a {appName}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <Link href="/" className="inline-flex items-center gap-3">
                                {brandIconUrl ? (
                                    <img
                                        src={brandIconUrl}
                                        alt=""
                                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-200/80 bg-slate-900/40 object-contain p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                                        width={48}
                                        height={48}
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-lg">
                                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                            <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l7 3.5v8.64l-7 3.5-7-3.5V7.68l7-3.5z" />
                                        </svg>
                                    </div>
                                )}
                                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{appName}</span>
                            </Link>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                        {title && (
                            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
                        )}
                        {description && (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                        )}
                        <div className={title || description ? 'mt-6' : ''}>{children}</div>
                    </div>

                    <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        &copy; {new Date().getFullYear()} {appName}. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
}
