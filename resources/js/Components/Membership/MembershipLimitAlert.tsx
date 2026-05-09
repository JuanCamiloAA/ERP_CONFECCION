import { Link, usePage } from '@inertiajs/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface OwnProps {
    message?: string;
}

function firstError(v: string | string[] | undefined): string | undefined {
    if (v == null) return undefined;
    return Array.isArray(v) ? v[0] : v;
}

/**
 * Muestra aviso + enlace cuando el backend devuelve `membership_limit` (tope del plan).
 */
export function MembershipLimitAlert({ message }: OwnProps) {
    const page = usePage<App.PageProps>();
    const fromProps = firstError(page.props.errors?.membership_limit);
    const text = message ?? fromProps;
    if (!text) return null;

    const auth = page.props.auth?.user;
    const href = auth?.is_super_admin
        ? route('super-admin.membership-plans.index')
        : auth?.company_id
          ? route('companies.edit', auth.company_id)
          : route('dashboard');

    const linkLabel = auth?.is_super_admin ? 'Ir a planes de membresía' : 'Ver y ajustar plan de la empresa';

    return (
        <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100"
        >
            <div className="flex gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                <p>{text}</p>
            </div>
            <div>
                <Link
                    href={href}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                    {linkLabel}
                </Link>
            </div>
        </div>
    );
}
