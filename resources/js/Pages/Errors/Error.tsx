import { Head, Link } from '@inertiajs/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';

interface Props {
    status: number;
    message?: string;
}

export default function ErrorPage({ status, message }: Props) {
    const titles: Record<number, string> = {
        404: 'Pagina no encontrada',
        500: 'Error del servidor',
        503: 'Servicio no disponible',
    };

    return (
        <>
            <Head title={`Error ${status}`} />
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
                <div className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                        <ExclamationTriangleIcon className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
                        {status} - {titles[status] ?? 'Error'}
                    </h1>
                    {message && (
                        <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">{message}</p>
                    )}
                    <div className="mt-8">
                        <Link href="/dashboard">
                            <Button>Volver al inicio</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
