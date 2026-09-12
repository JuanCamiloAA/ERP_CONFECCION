import {
    CalendarBlank,
    Envelope,
    IdentificationCard,
    Phone,
    Warning,
    Info,
    Sparkle,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EmployeeProfile, ProfileAlert } from '@/types';
import { ProgressBar, Restricted, StatTile, StatusTag } from './primitives';

/**
 * Cabecera de la ficha: quién es, cómo va su quincena y qué hay que resolver.
 *
 * En modo `self` es lo primero que ve el operario al entrar, y por eso el resumen del
 * periodo va arriba: la pregunta que trae es «cuánto llevo», no «cuál es mi dirección».
 */
export function ProfileHeader({
    profile,
    onAlertAction,
}: {
    profile: EmployeeProfile;
    onAlertAction: (alert: ProfileAlert) => void;
}) {
    const { identity, contact, metrics, permissions, lifecycle, alerts } = profile;
    const isSelf = profile.mode === 'self';

    return (
        <div className="space-y-4">
            <div className="emp-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <Avatar src={identity.photo} name={identity.full_name} size="xl" zoomable />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-[22px] leading-tight" style={{ color: 'var(--emp-text)' }}>
                                {identity.full_name}
                            </h1>
                            <StatusTag
                                label={identity.is_active ? 'Activo' : 'Inactivo'}
                                tone={identity.is_active ? 'ok' : 'warn'}
                            />
                            <StatusTag label={lifecycle.status_label} tone="accent" />
                        </div>

                        <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                            <HeaderFact icon={<IdentificationCard size={14} aria-hidden="true" />} label="Documento">
                                {identity.document_type} {identity.document_number}
                            </HeaderFact>
                            {contact.phone ? (
                                <HeaderFact icon={<Phone size={14} aria-hidden="true" />} label="Teléfono">
                                    {contact.phone}
                                </HeaderFact>
                            ) : null}
                            {contact.email ? (
                                <HeaderFact icon={<Envelope size={14} aria-hidden="true" />} label="Correo">
                                    {contact.email}
                                </HeaderFact>
                            ) : null}
                            <HeaderFact icon={<CalendarBlank size={14} aria-hidden="true" />} label="Ingreso">
                                {formatDate(identity.hire_date)}
                            </HeaderFact>
                        </dl>
                    </div>
                </div>
            </div>

            {/* ------------------------------------------------ alertas accionables */}
            {alerts.length > 0 ? (
                <ul className="space-y-2" aria-label="Alertas de la ficha">
                    {alerts.map((alert) => (
                        <li key={alert.key}>
                            <AlertRow alert={alert} onAction={() => onAlertAction(alert)} />
                        </li>
                    ))}
                </ul>
            ) : null}

            {/* ------------------------------------------------ quincena en curso */}
            <section aria-label="Resumen del periodo">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                        {isSelf ? 'Mi quincena en curso' : 'Quincena en curso'}
                    </h2>
                    <span className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        {metrics.period_label} · {formatDate(metrics.period_start)} – {formatDate(metrics.period_end)}
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Unidades producidas"
                        value={metrics.units.toLocaleString('es-CO')}
                        hint={`${metrics.days_with_production} día(s) con registro`}
                    />
                    <StatTile
                        label="Producido"
                        value={metrics.restricted ? <Restricted /> : formatCurrency(metrics.produced_value ?? 0)}
                    />
                    <StatTile
                        label="Anticipos por descontar"
                        value={metrics.restricted ? <Restricted /> : formatCurrency(metrics.advances_pending ?? 0)}
                        hint={metrics.restricted ? undefined : `${formatCurrency(metrics.advances_period ?? 0)} en este periodo`}
                    />
                    <StatTile
                        label="Neto estimado"
                        tone="accent"
                        value={metrics.restricted ? <Restricted /> : formatCurrency(metrics.net_estimate ?? 0)}
                        hint="Estimado; la nómina aplica deducciones y ajustes"
                    />
                </div>

                {metrics.units_goal > 0 ? (
                    <div className="emp-card mt-2.5 p-3.5">
                        <ProgressBar
                            value={metrics.units}
                            goal={metrics.units_goal}
                            percent={metrics.units_progress}
                            caption={
                                metrics.units_goal_source === 'company'
                                    ? 'Avance contra la meta de unidades'
                                    : 'Avance contra el periodo anterior'
                            }
                        />
                    </div>
                ) : null}

                {!permissions.canViewSalary ? (
                    <p className="mt-2.5 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                        Los importes de esta persona están restringidos para tu rol.
                    </p>
                ) : null}
            </section>
        </div>
    );
}

function HeaderFact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-1.5">
            <dt className="sr-only">{label}</dt>
            <span aria-hidden="true" className="shrink-0">
                {icon}
            </span>
            <dd>{children}</dd>
        </div>
    );
}

/**
 * Alerta con su acción directa. El acento es el borde izquierdo, nunca el fondo: rellenar
 * la fila con el color de marca es lo que el sistema prohíbe.
 */
function AlertRow({ alert, onAction }: { alert: ProfileAlert; onAction: () => void }) {
    const tone = alert.tone === 'warning' ? 'var(--emp-danger)' : alert.tone === 'accent' ? 'var(--emp-accent-line)' : 'var(--emp-border)';
    const Icon = alert.tone === 'warning' ? Warning : alert.tone === 'accent' ? Sparkle : Info;

    return (
        <div
            className="emp-card flex flex-wrap items-center gap-3 p-3"
            style={{ borderLeft: `2px solid ${tone}`, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}
        >
            <span className="shrink-0" style={{ color: tone }} aria-hidden="true">
                <Icon size={16} weight="bold" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {alert.label}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                    {alert.detail}
                </p>
            </div>
            <button type="button" className="emp-btn emp-btn-sm emp-btn-primary shrink-0" onClick={onAction}>
                {alert.action_label}
            </button>
        </div>
    );
}

export default ProfileHeader;
