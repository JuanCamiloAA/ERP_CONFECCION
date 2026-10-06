import { Link } from '@inertiajs/react';
import { WarningCircle } from '@phosphor-icons/react';
import { Can } from '@/Components/UI/Can';
import { formatDate } from '@/lib/utils';
import type { Company } from '@/types';

/**
 * Aviso de membresía en gracia (o suspendida) sobre cualquier pantalla.
 *
 * En gracia la empresa trabaja normal, y justo por eso nadie se entera de que venció hasta
 * que la suspensión le cierra el sistema. Este aviso es lo que evita esa sorpresa.
 */
export function MembershipNotice({ company }: { company: Company | null }) {
    const status = company?.membership_status;

    if (status !== 'gracia' && status !== 'suspendida') return null;

    const message =
        status === 'gracia'
            ? `La membresía de ${company?.name} venció. Hay plazo hasta el ${
                  company?.grace_ends_at ? formatDate(company.grace_ends_at) : '—'
              } para pagarla; después el acceso queda limitado.`
            : `La membresía de ${company?.name} está suspendida. Pagarla reactiva el sistema para todo el equipo.`;

    return (
        <div
            role="status"
            className="emp-note mb-4 flex flex-wrap items-center gap-x-3 gap-y-1"
            style={status === 'suspendida' ? { borderColor: 'var(--emp-danger)' } : undefined}
        >
            <WarningCircle size={15} className="shrink-0" />
            <span className="min-w-0 flex-1">{message}</span>
            <Can permission="settings.index.view">
                <Link href={`${route('settings.index')}#membresia`} className="shrink-0 underline underline-offset-2">
                    Ver la membresía
                </Link>
            </Can>
        </div>
    );
}

export default MembershipNotice;
