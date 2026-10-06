import { useForm } from '@inertiajs/react';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface MembershipAdminCharge {
    id: number;
    date: string | null;
    concept: string;
    amount: number;
    currency: string;
    status: string;
    status_label: string;
    method_label: string | null;
    reference: string | null;
    failure_reason: string | null;
}

export interface MembershipAdminEvent {
    id: number;
    type: string;
    label: string;
    data: Record<string, unknown>;
    user: string | null;
    created_at: string | null;
}

export interface MembershipAdmin {
    status: string;
    status_label: string;
    grace_ends_at: string | null;
    days_left: number | null;
    cycle_price: number | null;
    charges: MembershipAdminCharge[];
    events: MembershipAdminEvent[];
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    activa: 'success',
    prueba: 'info',
    gracia: 'warning',
    suspendida: 'danger',
};

const CHARGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
    pagado: 'success',
    pendiente: 'warning',
    fallido: 'danger',
    anulado: 'neutral',
};

/** Una línea legible de lo que dice cada renglón de la bitácora. */
function eventDetail(event: MembershipAdminEvent): string | null {
    const data = event.data;
    const parts: string[] = [];

    if (typeof data.until === 'string') parts.push(`hasta ${formatDate(data.until)}`);
    if (typeof data.reference === 'string') parts.push(data.reference);

    const before = data.before as Record<string, unknown> | undefined;
    const after = data.after as Record<string, unknown> | undefined;

    if (before && after) {
        for (const [key, label] of [
            ['plan', 'plan'],
            ['cycle', 'periodo'],
            ['ends_at', 'vence'],
            ['status', 'estado'],
        ] as const) {
            if (before[key] !== after[key]) {
                parts.push(`${label}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`);
            }
        }
    }

    if (typeof data.reason === 'string' && data.reason !== '') parts.push(`«${data.reason}»`);
    if (typeof data.enabled === 'boolean') parts.push(data.enabled ? 'encendida' : 'apagada');

    return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * La membresía vista por el super admin: en qué estado está, registrar un pago recibido por
 * fuera de la pasarela, los últimos cobros y la bitácora de todo lo que le ha pasado.
 *
 * Vive fuera del formulario de la empresa a propósito: el pago manual es una acción con su
 * propio envío, y un formulario dentro de otro mandaría los dos a la vez.
 */
export function CompanyMembershipPanel({ companyId, membership }: { companyId: number; membership: MembershipAdmin }) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        note: '',
        amount: membership.cycle_price != null ? String(membership.cycle_price) : '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('companies.membership-payments.store', companyId), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset('note');
            },
        });
    };

    return (
        <Card>
            <CardHeader
                title="Membresía: estado y cobros"
                description="Pagos registrados, renovaciones y cada cambio que ha tenido la membresía."
                action={
                    <Button
                        variant="outline"
                        size="sm"
                        icon={<BanknotesIcon className="h-4 w-4" />}
                        onClick={() => setOpen(true)}
                    >
                        Registrar pago manual
                    </Button>
                }
            />

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={STATUS_VARIANT[membership.status] ?? 'neutral'} size="md">
                    {membership.status_label}
                </Badge>
                {membership.status === 'gracia' && membership.grace_ends_at ? (
                    <span className="text-[color:var(--emp-muted)]">
                        Se suspende el {formatDate(membership.grace_ends_at)} si no paga.
                    </span>
                ) : null}
                {membership.status === 'suspendida' ? (
                    <span className="text-[color:var(--emp-muted)]">
                        Sus usuarios solo pueden entrar a «Mi empresa» a pagar.
                    </span>
                ) : null}
                {membership.cycle_price != null ? (
                    <span className="text-[color:var(--emp-muted)]">
                        Precio del periodo: <span className="tabular-nums">{formatCurrency(membership.cycle_price)}</span>
                    </span>
                ) : null}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="min-w-0">
                    <p className="emp-kicker mb-2">Últimos cobros</p>
                    {membership.charges.length === 0 ? (
                        <p className="text-sm text-[color:var(--emp-muted)]">Sin cobros registrados.</p>
                    ) : (
                        <ul className="divide-y divide-[color:var(--emp-row)]">
                            {membership.charges.map((charge) => (
                                <li key={charge.id} className="flex items-start justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-[color:var(--emp-text)]">{charge.concept}</p>
                                        <p className="truncate text-xs text-[color:var(--emp-muted)]">
                                            {charge.date ? formatDate(charge.date) : '—'}
                                            {charge.method_label ? ` · ${charge.method_label}` : ''}
                                            {charge.reference ? ` · ${charge.reference}` : ''}
                                        </p>
                                        {charge.failure_reason ? (
                                            <p className="text-xs text-rose-600 dark:text-rose-400">{charge.failure_reason}</p>
                                        ) : null}
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <span className="text-sm tabular-nums text-[color:var(--emp-text)]">
                                            {formatCurrency(charge.amount, charge.currency)}
                                        </span>
                                        <Badge variant={CHARGE_VARIANT[charge.status] ?? 'neutral'}>{charge.status_label}</Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="min-w-0">
                    <p className="emp-kicker mb-2">Bitácora</p>
                    {membership.events.length === 0 ? (
                        <p className="text-sm text-[color:var(--emp-muted)]">Todavía no hay movimientos registrados.</p>
                    ) : (
                        <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {membership.events.map((event) => {
                                const detail = eventDetail(event);

                                return (
                                    <li key={event.id} className="text-sm">
                                        <p className="text-[color:var(--emp-text)]">
                                            {event.label}
                                            <span className="ml-2 text-xs text-[color:var(--emp-subtle)]">
                                                {event.created_at ? formatDate(event.created_at) : ''}
                                                {event.user ? ` · ${event.user}` : ' · Sistema'}
                                            </span>
                                        </p>
                                        {detail ? <p className="text-xs text-[color:var(--emp-muted)]">{detail}</p> : null}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Registrar pago manual"
                description="Para pagos recibidos por fuera de la pasarela (transferencia, efectivo). Renueva un periodo y, si estaba en gracia o suspendida, la reactiva."
                footer={
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="manual-payment-form" disabled={processing}>
                            Registrar pago
                        </Button>
                    </div>
                }
            >
                <form id="manual-payment-form" onSubmit={submit} className="space-y-4">
                    <Input
                        label="De dónde salió el pago"
                        value={data.note}
                        onChange={(e) => setData('note', e.target.value)}
                        error={errors.note}
                        placeholder="Transferencia Bancolombia 12/10"
                        maxLength={120}
                        required
                    />
                    <Input
                        type="number"
                        min={1}
                        label="Valor recibido"
                        value={data.amount}
                        onChange={(e) => setData('amount', e.target.value)}
                        error={errors.amount ?? (errors as Record<string, string>).membership}
                        description="Por defecto, el precio del periodo de cobro de la empresa."
                    />
                </form>
            </Modal>
        </Card>
    );
}

export default CompanyMembershipPanel;
