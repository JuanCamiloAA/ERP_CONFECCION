import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { Textarea } from '@/Components/UI/Textarea';

export interface PlanInquirySelection {
    id: number;
    name: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    plan: PlanInquirySelection | null;
    /** Si está definido, se ofrece abrir el cliente de correo con un borrador. */
    mailtoTarget?: string | null;
}

function buildMailtoDraft(plan: PlanInquirySelection | null, data: Record<string, unknown>): string {
    const lines: string[] = [];
    lines.push('Solicitud desde la landing');
    lines.push('');
    if (plan) {
        lines.push(`Plan de interés: ${plan.name}`);
        lines.push('');
    }
    lines.push('— Empresa —');
    lines.push(`Nombre: ${data.company_name ?? ''}`);
    if (data.company_tax_id) lines.push(`NIT / documento: ${data.company_tax_id}`);
    if (data.company_phone) lines.push(`Teléfono: ${data.company_phone}`);
    if (data.company_email) lines.push(`Correo: ${data.company_email}`);
    lines.push('');
    lines.push('— Administrador —');
    lines.push(`Nombre: ${data.admin_full_name ?? ''}`);
    lines.push(`Correo: ${data.admin_email ?? ''}`);
    if (data.admin_phone) lines.push(`Teléfono: ${data.admin_phone}`);
    lines.push('');
    if (data.message) {
        lines.push('— Mensaje —');
        lines.push(String(data.message));
    }
    return lines.join('\n');
}

export function PlanInquiryModal({ open, onClose, plan, mailtoTarget }: Props) {
    const form = useForm({
        company_name: '',
        company_tax_id: '',
        company_phone: '',
        company_email: '',
        admin_full_name: '',
        admin_email: '',
        admin_phone: '',
        message: '',
        membership_plan_id: '' as string | number,
    });

    useEffect(() => {
        if (!open) {
            return;
        }
        form.clearErrors();
        form.setData({
            company_name: '',
            company_tax_id: '',
            company_phone: '',
            company_email: '',
            admin_full_name: '',
            admin_email: '',
            admin_phone: '',
            message: '',
            membership_plan_id: plan?.id ?? '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicio al abrir / cambiar plan
    }, [open, plan?.id]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void form.post(route('landing.plan-inquiry'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Solicitud enviada correctamente.');
                onClose();
            },
        });
    };

    const openMailto = () => {
        if (!mailtoTarget) {
            return;
        }
        const subject = plan ? `Solicitud de plan: ${plan.name}` : 'Solicitud de información — MiTallerPro';
        const body = buildMailtoDraft(plan, form.data);
        const addr = mailtoTarget.replace(/^mailto:/i, '').trim();
        window.location.href = `mailto:${addr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <Modal
            open={open}
            onClose={() => {
                if (!form.processing) {
                    onClose();
                }
            }}
            size="2xl"
            title={
                plan ? (
                    <>
                        Solicitar plan: <span className="text-indigo-600 dark:text-indigo-400">{plan.name}</span>
                    </>
                ) : (
                    'Solicitar información'
                )
            }
            description="Diligencie los datos de la empresa y del administrador. Enviaremos su solicitud al equipo (super administradores)."
            footer={
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                    {mailtoTarget ? (
                        <Button type="button" variant="outline" disabled={form.processing} onClick={openMailto} className="sm:mr-auto">
                            Abrir en mi correo
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" disabled={form.processing} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="plan-inquiry-form" loading={form.processing}>
                        Enviar solicitud
                    </Button>
                </div>
            }
        >
            <form id="plan-inquiry-form" onSubmit={submit} className="space-y-4">
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-600">
                    <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Empresa</legend>
                    <Input
                        label="Nombre de la empresa"
                        name="company_name"
                        value={form.data.company_name}
                        onChange={(e) => form.setData('company_name', e.target.value)}
                        error={form.errors.company_name}
                        required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            label="NIT o documento"
                            name="company_tax_id"
                            value={form.data.company_tax_id}
                            onChange={(e) => form.setData('company_tax_id', e.target.value)}
                            error={form.errors.company_tax_id}
                        />
                        <Input
                            label="Teléfono"
                            name="company_phone"
                            type="tel"
                            value={form.data.company_phone}
                            onChange={(e) => form.setData('company_phone', e.target.value)}
                            error={form.errors.company_phone}
                        />
                    </div>
                    <Input
                        label="Correo de la empresa"
                        name="company_email"
                        type="email"
                        value={form.data.company_email}
                        onChange={(e) => form.setData('company_email', e.target.value)}
                        error={form.errors.company_email}
                    />
                </fieldset>
                <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-600">
                    <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Administrador de la empresa</legend>
                    <Input
                        label="Nombre completo"
                        name="admin_full_name"
                        value={form.data.admin_full_name}
                        onChange={(e) => form.setData('admin_full_name', e.target.value)}
                        error={form.errors.admin_full_name}
                        required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                            label="Correo electrónico"
                            name="admin_email"
                            type="email"
                            value={form.data.admin_email}
                            onChange={(e) => form.setData('admin_email', e.target.value)}
                            error={form.errors.admin_email}
                            required
                        />
                        <Input
                            label="Teléfono"
                            name="admin_phone"
                            type="tel"
                            value={form.data.admin_phone}
                            onChange={(e) => form.setData('admin_phone', e.target.value)}
                            error={form.errors.admin_phone}
                        />
                    </div>
                </fieldset>
                <Textarea
                    label="Mensaje (opcional)"
                    name="message"
                    value={form.data.message}
                    onChange={(e) => form.setData('message', e.target.value)}
                    error={form.errors.message}
                    rows={3}
                />
            </form>
        </Modal>
    );
}
