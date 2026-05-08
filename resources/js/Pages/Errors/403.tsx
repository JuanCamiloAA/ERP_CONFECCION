import { Head, Link } from '@inertiajs/react';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';

interface Props {
    permission?: string;
    message?: string;
}

export default function Forbidden({ permission, message }: Props) {
    return (
        <>
            <Head title="Acceso denegado" />
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
                <div className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
                        <LockClosedIcon className="h-10 w-10 text-rose-600 dark:text-rose-400" />
                    </div>
                    <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">403 - Acceso denegado</h1>
                    <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
                        {message ?? 'No tienes permiso para acceder a esta pagina.'}
                    </p>
                    {permission && (
                        <p className="mt-4 inline-block rounded-md bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Permiso requerido: {permission}
                        </p>
                    )}
                    <div className="mt-8 flex items-center justify-center gap-3">
                        <Link href="/dashboard">
                            <Button>Ir al Dashboard</Button>
                        </Link>
                        <Button variant="ghost" onClick={() => window.history.back()}>
                            Volver atras
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
