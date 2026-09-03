import { router } from '@inertiajs/react';
import { CreditCard, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { BillingHistoryTable } from '@/Components/Settings/BillingHistoryTable';
import { PaymentMethodModal } from '@/Components/Settings/PaymentMethodModal';
import { SettingsSection } from '@/Components/Settings/SettingsSection';
import { Can } from '@/Components/UI/Can';
import { EmpSwitch } from '@/Components/UI/ModuleFields';
import { usePermissions } from '@/contexts/PermissionsContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Membership } from '@/types';

/** Aviso desde mes y medio antes, que es cuando aún da tiempo a renovar sin cortar el servicio. */
const EXPIRING_SOON_DAYS = 45;

type Tone = 'ok' | 'warn' | 'danger' | 'muted';

const TONE_COLOR: Record<Tone, string> = {
    ok: 'var(--emp-ok)',
    warn: 'var(--emp-accent-on)',
    danger: 'var(--emp-danger)',
    muted: 'var(--emp-muted)',
};

function state(membership: Membership): { label: string; tone: Tone } {
    if (! membership.is_active) return { label: 'Empresa inactiva', tone: 'danger' };
    if (membership.is_expired) return { label: 'Vencida', tone: 'danger' };
    if (membership.days_left !== null && membership.days_left <= EXPIRING_SOON_DAYS) {
        return { label: 'Por vencer', tone: 'warn' };
    }
    if (membership.plan === null) return { label: 'Sin plan asignado', tone: 'muted' };

    return { label: 'Activa', tone: 'ok' };
}

/**
 * Membresía de la empresa: estado, límites, tarjeta y cobros.
 *
 * El plan y la fecha de vencimiento son de solo lectura —los fija el super admin desde
 * Empresas—; lo único accionable aquí es la tarjeta y la renovación automática, y ambas
 * detrás de `settings.membership.manage_payment`, que es más restrictivo que el permiso de
 * editar el resto de la pantalla: quien ajusta deducciones no tiene por qué poder cambiar
 * con qué tarjeta se cobra la empresa.
 */
export function MembershipSection({ membership }: { membership: Membership }) {
    const { can } = usePermissions();
    const canManagePayment = can('settings.membership.manage_payment');

    const [modalOpen, setModalOpen] = useState(false);
    const { label, tone } = state(membership);
    const { usage, payment_method: card } = membership;

    const expiry = () => {
        if (membership.ends_at === null) return 'Sin fecha de vencimiento';
        if (membership.is_expired) return `Venció el ${formatDate(membership.ends_at)}`;
        if (membership.days_left === null) return formatDate(membership.ends_at);
        if (membership.days_left === 0) return `Vence hoy, ${formatDate(membership.ends_at)}`;

        return `${formatDate(membership.ends_at)} · ${membership.days_left} ${
            membership.days_left === 1 ? 'día' : 'días'
        }`;
    };

    const toggleAutoDebit = (enabled: boolean) => {
        router.post(
            route('settings.auto-debit.toggle'),
            { enabled },
            { preserveScroll: true },
        );
    };

    return (
        <SettingsSection
            id="membresia"
            title="Membresía"
            description="Plan contratado, vigencia, consumo de los límites y cobro."
            aside={
                <span className="emp-pill" style={{ color: TONE_COLOR[tone], borderColor: TONE_COLOR[tone] }}>
                    {label}
                </span>
            }
        >
            {/* ---------------------------------------------------------- plan */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Plan" value={membership.plan?.name ?? 'Sin plan asignado'} />
                <Field
                    label="Precio mensual"
                    value={
                        membership.plan?.price_monthly != null
                            ? formatCurrency(membership.plan.price_monthly)
                            : 'No definido'
                    }
                />
                <Field label="Inicio" value={membership.started_at ? formatDate(membership.started_at) : '—'} />
                <Field label="Vencimiento" value={expiry()} tone={membership.is_expired ? 'danger' : undefined} />
            </div>

            {/* -------------------------------------------------------- límites */}
            <div
                className="mt-4 grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2"
                style={{ borderTop: '1px solid var(--emp-border)' }}
            >
                <Usage label="Usuarios staff" used={usage.staff_used} limit={usage.staff_limit} />
                <Usage label="Empleados" used={usage.employees_used} limit={usage.employees_limit} />
            </div>

            {membership.plan && membership.plan.features.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                    {membership.plan.features.map((feature) => (
                        <li key={feature}>
                            <span className="emp-pill">{feature}</span>
                        </li>
                    ))}
                </ul>
            ) : null}

            {/* --------------------------------------------------------- cobro */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--emp-border)' }}>
                <p className="emp-kicker">Cobro</p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-on)' }}
                    >
                        <CreditCard size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                        {card ? (
                            <>
                                <p className="truncate text-[14px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                                    {card.brand} ···· {card.last4}
                                </p>
                                <p className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    {card.holder_name} · vence {card.expiry_label}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                    Sin tarjeta guardada
                                </p>
                                <p className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    Hoy la renovación se gestiona con soporte.
                                </p>
                            </>
                        )}
                    </div>

                    <Can permission="settings.membership.manage_payment">
                        <button type="button" onClick={() => setModalOpen(true)} className="emp-btn emp-btn-sm">
                            {card ? 'Cambiar tarjeta' : 'Agregar tarjeta'}
                        </button>
                    </Can>
                </div>

                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--emp-border)' }}>
                    {canManagePayment ? (
                        <EmpSwitch
                            checked={membership.auto_debit_enabled}
                            onChange={toggleAutoDebit}
                            disabled={! card && ! membership.auto_debit_enabled}
                            label="Renovación automática"
                            description={
                                card
                                    ? 'Se cobra la renovación a esta tarjeta al llegar la fecha.'
                                    : 'Agrega una tarjeta para poder activarla.'
                            }
                        />
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                    Renovación automática
                                </p>
                                <p className="text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    Solo el propietario de la cuenta puede cambiarla.
                                </p>
                            </div>
                            <span className="emp-pill shrink-0">
                                {membership.auto_debit_enabled ? 'Activada' : 'Desactivada'}
                            </span>
                        </div>
                    )}

                    {membership.auto_debit_enabled && membership.next_charge_at ? (
                        <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                            Próximo cobro: {formatDate(membership.next_charge_at)}
                            {membership.next_charge_amount != null
                                ? ` · ${formatCurrency(membership.next_charge_amount)}`
                                : ''}
                        </p>
                    ) : null}

                    {! membership.auto_debit_enabled &&
                    membership.days_left !== null &&
                    membership.days_left <= EXPIRING_SOON_DAYS &&
                    ! membership.is_expired ? (
                        <p className="emp-note mt-2 flex items-start gap-2">
                            <WarningCircle size={14} className="mt-0.5 shrink-0" />
                            <span>
                                La membresía vence en {membership.days_left}{' '}
                                {membership.days_left === 1 ? 'día' : 'días'} y la renovación automática está
                                desactivada.
                            </span>
                        </p>
                    ) : null}
                </div>
            </div>

            {/* ----------------------------------------------------- historial */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--emp-border)' }}>
                <p className="emp-kicker mb-2">Historial de cobros</p>
                <BillingHistoryTable charges={membership.billing_charges} />
            </div>

            <p className="mt-4 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                El plan y la fecha de vencimiento los administra el proveedor del sistema. Para cambiar de plan,
                contacta a soporte.
            </p>

            {canManagePayment ? (
                <PaymentMethodModal open={modalOpen} onClose={() => setModalOpen(false)} current={card} />
            ) : null}
        </SettingsSection>
    );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
    return (
        <div className="min-w-0">
            <p className="emp-kicker truncate">{label}</p>
            <p
                className="mt-0.5 truncate text-[14px]"
                style={{ color: tone ? TONE_COLOR[tone] : 'var(--emp-text)' }}
                title={value}
            >
                {value}
            </p>
        </div>
    );
}

/** Consumo de un límite del plan. Ámbar desde el 75 %, rojo desde el 90 %. */
function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
    const unlimited = limit === null;
    const pct = unlimited || limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));

    const fill = unlimited
        ? 'var(--emp-faint)'
        : pct >= 90
          ? 'var(--emp-danger)'
          : pct >= 75
            ? 'var(--emp-accent-line)'
            : 'var(--emp-accent)';

    return (
        <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {label}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--emp-text)' }}>
                    {used} / {unlimited ? '∞' : limit}
                </span>
            </div>
            <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--emp-row)' }}
                role="presentation"
            >
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: fill }} />
            </div>
        </div>
    );
}

export default MembershipSection;
