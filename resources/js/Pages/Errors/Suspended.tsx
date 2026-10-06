import { Head, router } from '@inertiajs/react';
import { PauseCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';

interface Props {
    company: string;
}

/**
 * Membresía suspendida, para quien no puede ver «Mi empresa».
 *
 * Quien sí puede, va directo a pagar. Aquí solo se explica qué pasa y a quién acudir: no
 * hay nada que esta persona pueda hacer por su cuenta.
 */
export default function Suspended({ company }: Props) {
    return (
        <>
            <Head title="Membresía suspendida" />
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
                <div className="max-w-md text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                        <PauseCircleIcon className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Membresía suspendida</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">
                        La membresía de <strong>{company}</strong> no se renovó a tiempo y el acceso quedó en pausa.
                        Avísale al administrador de la empresa: en cuanto la pague, todo vuelve a funcionar.
                    </p>
                    <div className="mt-8 flex items-center justify-center">
                        <Button variant="ghost" onClick={() => router.post(route('logout'))}>
                            Cerrar sesión
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
