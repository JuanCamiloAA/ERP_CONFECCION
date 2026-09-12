import { ArrowRight } from '@phosphor-icons/react';
import { formatDateTime } from '@/lib/utils';
import type { ProfileAuditEntry } from '@/types';

/**
 * Bitácora de la ficha.
 *
 * Arranca vacía a propósito —no se migró nada— y se llena desde el día del despliegue:
 * una bitácora con historial inventado sería peor que no tenerla. Los valores sensibles
 * llegan ya enmascarados del servidor; aquí no hay nada que ocultar.
 */
export function ProfileAudit({ entries }: { entries: ProfileAuditEntry[] }) {
    if (entries.length === 0) {
        return (
            <p className="text-[12.5px]" style={{ color: 'var(--emp-subtle)' }}>
                Sin movimientos registrados todavía. Cada cambio de datos, de rol o de acceso deja aquí su rastro.
            </p>
        );
    }

    return (
        <ol className="space-y-0" aria-label="Bitácora de cambios">
            {entries.map((entry) => (
                <li key={entry.id} className="emp-row-sep py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                            {entry.field_label ?? entry.event_label}
                        </span>
                        <span className="emp-pill">{entry.event_label}</span>
                        <span className="ml-auto text-[11.5px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                            {formatDateTime(entry.created_at)}
                        </span>
                    </div>

                    {entry.old_value || entry.new_value ? (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
                            <span style={{ color: 'var(--emp-subtle)' }}>{entry.old_value ?? '—'}</span>
                            <ArrowRight size={12} aria-label="cambió a" style={{ color: 'var(--emp-faint)' }} />
                            <span style={{ color: 'var(--emp-text)' }}>{entry.new_value ?? '—'}</span>
                        </p>
                    ) : null}

                    <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--emp-subtle)' }}>
                        {entry.actor ?? 'Sistema'}
                    </p>
                </li>
            ))}
        </ol>
    );
}

export default ProfileAudit;
