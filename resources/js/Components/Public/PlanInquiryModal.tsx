import { useForm } from '@inertiajs/react';
import { X } from '@phosphor-icons/react';
import { FormEvent, useEffect } from 'react';

/**
 * Formulario de solicitud de plan de la landing publica.
 *
 * Envia a la ruta que ya existia (landing.plan-inquiry), que avisa por correo a los super
 * usuarios. Aqui no se crea nada en base de datos: es solo un contacto comercial.
 */

interface Props {
    plan: { id: number; name: string } | null;
    onClose: () => void;
}

export function PlanInquiryModal({ plan, onClose }: Props) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        membership_plan_id: null as number | null,
        company_name: '',
        company_tax_id: '',
        company_phone: '',
        company_email: '',
        admin_full_name: '',
        admin_email: '',
        admin_phone: '',
        message: '',
    });

    useEffect(() => {
        if (plan) {
            setData('membership_plan_id', plan.id);
            clearErrors();
        }
        // Solo debe reaccionar al plan elegido; setData y clearErrors son estables.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan]);

    if (!plan) {
        return null;
    }

    const cerrar = () => {
        reset();
        onClose();
    };

    const enviar = (e: FormEvent) => {
        e.preventDefault();
        post(route('landing.plan-inquiry'), {
            preserveScroll: true,
            onSuccess: () => cerrar(),
        });
    };

    const campo = (
        name: 'company_name' | 'company_tax_id' | 'company_phone' | 'company_email' | 'admin_full_name' | 'admin_email' | 'admin_phone',
        label: string,
        type = 'text',
        required = false,
    ) => (
        <div>
            <label htmlFor={`pi-${name}`} className="mb-1.5 block text-[13px]" style={{ color: 'var(--pub-gray-1)' }}>
                {label}
                {required ? ' *' : ''}
            </label>
            <div className="pub-field-shell h-12 px-3.5">
                <input
                    id={`pi-${name}`}
                    type={type}
                    value={data[name]}
                    onChange={(e) => setData(name, e.target.value)}
                    className="text-[14px]"
                    required={required}
                />
            </div>
            {errors[name] ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--pub-danger)' }}>
                    {errors[name]}
                </p>
            ) : null}
        </div>
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
            style={{ backgroundColor: 'rgba(0,0,0,.7)' }}
            role="dialog"
            aria-modal="true"
            aria-label={`Solicitar el plan ${plan.name}`}
        >
            <div
                className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl"
                style={{ backgroundColor: 'var(--pub-bg)', border: '1px solid var(--pub-gray-6)' }}
            >
                <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: '1px solid var(--pub-divider)' }}
                >
                    <div>
                        <p className="text-[17px]" style={{ color: 'var(--pub-text)' }}>
                            Solicitar el plan {plan.name}
                        </p>
                        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--pub-gray-3)' }}>
                            Déjanos tus datos y te contactamos.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={cerrar}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                        style={{ color: 'var(--pub-gray-2)' }}
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={enviar} className="space-y-4 px-5 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {campo('company_name', 'Nombre de la empresa', 'text', true)}
                        {campo('company_tax_id', 'NIT o documento')}
                        {campo('company_phone', 'Teléfono de la empresa', 'tel')}
                        {campo('company_email', 'Correo de la empresa', 'email')}
                        {campo('admin_full_name', 'Nombre del administrador', 'text', true)}
                        {campo('admin_email', 'Correo del administrador', 'email', true)}
                        {campo('admin_phone', 'Teléfono del administrador', 'tel')}
                    </div>

                    <div>
                        <label htmlFor="pi-message" className="mb-1.5 block text-[13px]" style={{ color: 'var(--pub-gray-1)' }}>
                            Mensaje
                        </label>
                        <textarea
                            id="pi-message"
                            rows={3}
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            className="pub-field w-full px-3.5 py-2.5 text-[14px]"
                        />
                        {errors.message ? (
                            <p className="mt-1 text-xs" style={{ color: 'var(--pub-danger)' }}>
                                {errors.message}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={cerrar} className="pub-btn pub-btn-quiet h-12 px-5 text-[14px]">
                            Cancelar
                        </button>
                        <button type="submit" disabled={processing} className="pub-btn h-12 px-5 text-[14px]">
                            {processing ? 'Enviando…' : 'Enviar solicitud'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
