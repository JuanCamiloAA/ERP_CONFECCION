import { Head, useForm } from '@inertiajs/react';
import { CheckCircle, Copy, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { EmpSwitch } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { formatDateTime } from '@/lib/utils';
import '../../../../css/module-ui.css';

type Environment = 'sandbox' | 'production';
type SecretField = 'private_key' | 'events_secret' | 'integrity_secret';

interface Credential {
    environment: Environment;
    public_key: string | null;
    is_complete: boolean;
    expected_prefix: string;
    updated_at: string | null;
    /** «····abcd» si hay secreto guardado, null si no. Nunca el valor. */
    secrets: Record<SecretField, string | null>;
}

interface Props {
    settings: {
        provider: string;
        environment: Environment;
        is_enabled: boolean;
        is_usable: boolean;
        updated_at: string | null;
        updated_by: string | null;
    };
    credentials: Record<Environment, Credential>;
    webhookUrl: string;
    environments: Environment[];
}

const ENVIRONMENT_LABEL: Record<Environment, string> = {
    sandbox: 'Pruebas (sandbox)',
    production: 'Producción',
};

const SECRET_FIELDS: { key: SecretField; label: string; hint: string }[] = [
    { key: 'private_key', label: 'Llave privada', hint: 'Para operaciones sobre transacciones.' },
    { key: 'events_secret', label: 'Secreto de eventos', hint: 'Con él se valida la firma de cada webhook.' },
    { key: 'integrity_secret', label: 'Secreto de integridad', hint: 'Con él se firma el enlace de pago.' },
];

export default function PaymentGatewayIndex({ settings, credentials, webhookUrl, environments }: Props) {
    const [copied, setCopied] = useState(false);

    /*
     * El segmento manda sobre las dos cosas: que credenciales se editan abajo y, al
     * guardar, que entorno queda en uso. Vive aqui y no dentro de la tarjeta porque el
     * formulario de credenciales tambien depende de el.
     */
    const settingsForm = useForm({
        environment: settings.environment,
        is_enabled: settings.is_enabled,
    });

    const selected = settingsForm.data.environment;
    const credential = credentials[selected];
    // El segmento no guarda solo: hasta que se pulse «Guardar», lo que cobra sigue siendo
    // lo que hay en base. Decirlo evita creer que ya se cambio de entorno.
    const unsavedEnvironment = selected !== settings.environment;

    const copyWebhook = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Sin portapapeles (contexto no seguro): la URL está a la vista para copiarla a mano.
        }
    };

    return (
        <AppLayout title="Pasarela de pagos">
            <Head title="Pasarela de pagos" />

            <div className="emp-form emp-bleed min-h-screen px-4 pb-8 pt-5 sm:px-[34px]">
                <div className="min-w-0">
                    <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                        Pasarela de pagos
                    </h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        Wompi cobra el primer mes cuando una empresa se registra. Cada entorno guarda sus propias
                        credenciales; el selector decide cuál se edita y cuál se usa.
                    </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
                    <div className="min-w-0 space-y-5">
                        {/* ------------------------------------- entorno y cobros */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                settingsForm.put(route('super-admin.payment-gateway.update'), {
                                    preserveScroll: true,
                                });
                            }}
                            className="emp-card p-[17px]"
                        >
                            <p className="emp-kicker">Entorno</p>
                            <div className="emp-seg mt-2 flex">
                                {environments.map((env) => (
                                    <button
                                        key={env}
                                        type="button"
                                        onClick={() => settingsForm.setData('environment', env)}
                                        className={`emp-seg-item ${selected === env ? 'emp-seg-on' : ''}`}
                                    >
                                        {ENVIRONMENT_LABEL[env]}
                                        {settings.environment === env ? (
                                            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                                · en uso
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                            {settingsForm.errors.environment ? (
                                <p className="emp-error">{settingsForm.errors.environment}</p>
                            ) : null}

                            {unsavedEnvironment ? (
                                <p className="emp-note mt-3 flex items-start gap-2">
                                    <WarningCircle size={14} className="mt-0.5 shrink-0" />
                                    <span>
                                        Estás editando {ENVIRONMENT_LABEL[selected].toLowerCase()}, pero los cobros
                                        siguen usando {ENVIRONMENT_LABEL[settings.environment].toLowerCase()}. Pulsa
                                        «Guardar» para cambiarlo.
                                    </span>
                                </p>
                            ) : null}

                            {selected === 'production' && ! unsavedEnvironment ? (
                                <p className="emp-note mt-3 flex items-start gap-2">
                                    <WarningCircle size={14} className="mt-0.5 shrink-0" />
                                    <span>En producción los cobros son reales desde el primer registro.</span>
                                </p>
                            ) : null}

                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--emp-border)' }}>
                                <EmpSwitch
                                    checked={settingsForm.data.is_enabled}
                                    onChange={(v) => settingsForm.setData('is_enabled', v)}
                                    label="Cobros en línea activos"
                                    description="Apagado, el registro público avisa de que el pago no está disponible."
                                />
                                {settingsForm.errors.is_enabled ? (
                                    <p className="emp-error">{settingsForm.errors.is_enabled}</p>
                                ) : null}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={settingsForm.processing}
                                    className="emp-btn emp-btn-sm emp-btn-primary"
                                >
                                    {settingsForm.processing ? 'Guardando…' : 'Guardar'}
                                </button>
                            </div>
                        </form>

                        {/*
                          * `key` fuerza a React a montar un formulario nuevo al cambiar de
                          * entorno: sin ella reutilizaria el estado y lo tecleado para uno
                          * aparecería en el otro.
                          */}
                        <CredentialCard
                            key={credential.environment}
                            credential={credential}
                            inUse={settings.environment === credential.environment}
                        />
                    </div>

                    {/* ---------------------------------------------------- estado */}
                    <div className="min-w-0 space-y-5">
                        <div className="emp-card p-[17px]">
                            <p className="emp-kicker">Estado</p>
                            <p
                                className="mt-1 flex items-center gap-1.5 text-[14px]"
                                style={{ color: settings.is_usable ? 'var(--emp-ok)' : 'var(--emp-danger)' }}
                            >
                                {settings.is_usable ? <CheckCircle size={15} weight="fill" /> : <WarningCircle size={15} />}
                                {settings.is_usable ? 'Cobros activos' : 'Cobros inactivos'}
                            </p>
                            <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                En uso: {ENVIRONMENT_LABEL[settings.environment]}
                            </p>

                            {/* Las dos, para saber que falta sin cambiar de pestaña. */}
                            <ul className="mt-3 space-y-1">
                                {environments.map((env) => (
                                    <li key={env} className="flex items-center justify-between gap-2 text-[12px]">
                                        <span style={{ color: 'var(--emp-muted)' }}>{ENVIRONMENT_LABEL[env]}</span>
                                        <span
                                            className="shrink-0"
                                            style={{
                                                color: credentials[env].is_complete
                                                    ? 'var(--emp-ok)'
                                                    : 'var(--emp-subtle)',
                                            }}
                                        >
                                            {credentials[env].is_complete ? 'Completas' : 'Incompletas'}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {settings.updated_at ? (
                                <p className="mt-3 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                                    Última edición {formatDateTime(settings.updated_at)}
                                    {settings.updated_by ? ` · ${settings.updated_by}` : ''}
                                </p>
                            ) : null}
                        </div>

                        <div className="emp-card p-[17px]">
                            <p className="emp-kicker">URL de eventos</p>
                            <p className="mt-1 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Pégala en el panel de Wompi, en «Eventos», para que confirme los pagos aunque el cliente
                                cierre la pestaña. Es la misma para los dos entornos.
                            </p>
                            <code
                                className="mt-2 block break-all rounded-lg px-2.5 py-2 text-[12px]"
                                style={{ backgroundColor: 'var(--emp-field-alt)', color: 'var(--emp-text)' }}
                            >
                                {webhookUrl}
                            </code>
                            <button type="button" onClick={copyWebhook} className="emp-btn emp-btn-sm mt-2">
                                <Copy size={14} />
                                {copied ? 'Copiada' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/* --------------------------------------------------------------- auxiliares */

/**
 * Credenciales del entorno seleccionado arriba.
 *
 * Los campos nacen vacíos a propósito: lo guardado no se devuelve nunca, y dejarlos así
 * conserva lo que ya había. Guarda solo este entorno, sin tocar el otro.
 */
function CredentialCard({ credential, inUse }: { credential: Credential; inUse: boolean }) {
    const { data, setData, put, processing, errors, reset } = useForm({
        public_key: '',
        private_key: '',
        events_secret: '',
        integrity_secret: '',
    });

    const label = ENVIRONMENT_LABEL[credential.environment];

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                put(route('super-admin.payment-gateway.credentials.update', credential.environment), {
                    preserveScroll: true,
                    onSuccess: () => reset(),
                });
            }}
            className="emp-card p-[17px]"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                        Credenciales de {label.toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                        Llave pública <code>{credential.expected_prefix}…</code>
                        {credential.updated_at ? ` · actualizadas ${formatDateTime(credential.updated_at)}` : ''}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    {inUse ? <span className="emp-pill emp-pill-accent">En uso</span> : null}
                    <span
                        className="emp-pill"
                        style={{ color: credential.is_complete ? 'var(--emp-ok)' : 'var(--emp-subtle)' }}
                    >
                        {credential.is_complete ? 'Completas' : 'Incompletas'}
                    </span>
                </div>
            </div>

            <div className="mt-4">
                <label className="emp-label" htmlFor={`pk-${credential.environment}`}>
                    Llave pública
                </label>
                <input
                    id={`pk-${credential.environment}`}
                    value={data.public_key}
                    onChange={(e) => setData('public_key', e.target.value)}
                    placeholder={credential.public_key ?? `${credential.expected_prefix}…`}
                    autoComplete="off"
                    className="emp-field"
                />
                <p className="emp-help">
                    {credential.public_key
                        ? `Guardada: ${credential.public_key}. Escribe una nueva solo si quieres cambiarla.`
                        : 'Viaja al navegador en el enlace de pago; no es un secreto.'}
                </p>
                {errors.public_key ? <p className="emp-error">{errors.public_key}</p> : null}
            </div>

            {SECRET_FIELDS.map((field) => (
                <div key={field.key} className="mt-4">
                    <label className="emp-label" htmlFor={`${field.key}-${credential.environment}`}>
                        {field.label}
                    </label>
                    <input
                        id={`${field.key}-${credential.environment}`}
                        type="password"
                        value={data[field.key]}
                        onChange={(e) => setData(field.key, e.target.value)}
                        placeholder={
                            credential.secrets[field.key] ? `Guardado ${credential.secrets[field.key]}` : 'Sin configurar'
                        }
                        autoComplete="new-password"
                        className="emp-field"
                    />
                    <p className="emp-help">
                        {field.hint}
                        {credential.secrets[field.key] ? ' Déjalo vacío para conservar el actual.' : ''}
                    </p>
                    {errors[field.key] ? <p className="emp-error">{errors[field.key]}</p> : null}
                </div>
            ))}

            <div className="mt-5 flex justify-end">
                <button type="submit" disabled={processing} className="emp-btn emp-btn-sm emp-btn-primary">
                    {processing ? 'Guardando…' : `Guardar ${label.toLowerCase()}`}
                </button>
            </div>
        </form>
    );
}
