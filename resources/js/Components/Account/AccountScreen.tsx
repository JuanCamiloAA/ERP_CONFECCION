import { router, usePage } from '@inertiajs/react';
import {
    DeviceMobile,
    Desktop,
    DeviceTablet,
    EnvelopeSimple,
    Key,
    Link as LinkIcon,
    ShieldCheck,
    SignOut,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmployeeFadingRule } from '@/Components/Employees/EmployeeFormSection';
import { EmpInput, EmpSelect } from '@/Components/UI/ModuleFields';
import { StatusTag } from '@/Components/People/primitives';
import { formatDateTime } from '@/lib/utils';
import type { AccountPayloadData, AccountSession } from '@/types';
import { AvatarUploader } from './AvatarUploader';
import { DirtyBar } from './DirtyBar';
import { ReauthDialog } from './ReauthDialog';
import { SecurityRow } from './SecurityRow';
import { RecoveryCodesDialog, TwoFactorSetupDialog, type TwoFactorSetup } from './TwoFactorSetupDialog';

/** Borrador editable de la pantalla: identidad + preferencias, que es lo que se guarda junto. */
interface Draft {
    name: string;
    last_name: string;
    phone: string;
    job_title: string;
    preferences: Record<string, boolean>;
}

function draftFrom(account: AccountPayloadData): Draft {
    return {
        name: account.user.name ?? '',
        last_name: account.user.lastName ?? '',
        phone: account.user.phone ?? '',
        job_title: account.user.jobTitle ?? '',
        preferences: { ...account.preferences },
    };
}

/**
 * «Mi perfil» de la cuenta de acceso.
 *
 * Es la pantalla completa para una cuenta administrativa sin ficha, y la mitad de
 * seguridad para quien sí la tiene: el bloque de identidad se esconde cuando la ficha ya
 * lo cubre, para no ofrecer dos formularios del mismo nombre.
 *
 * No dibuja cabecera de aplicación, marca ni navegación: eso lo provee `AppLayout`.
 */
export function AccountScreen({
    account,
    /** true cuando la ficha de empleado ya muestra la identidad más arriba. */
    identityHandledElsewhere = false,
}: {
    account: AccountPayloadData;
    identityHandledElsewhere?: boolean;
}) {
    const flash = usePage<App.PageProps>().props.flash as Record<string, unknown> | undefined;

    const original = useMemo(() => draftFrom(account), [account]);
    const [draft, setDraft] = useState<Draft>(original);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    // Tras guardar, el servidor devuelve el payload nuevo: el borrador vuelve a partir de
    // él para que «sin guardar» desaparezca sin recargar la página.
    useEffect(() => {
        setDraft(original);
    }, [original]);

    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(original),
        [draft, original],
    );

    const [emailOpen, setEmailOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [twoFactorStartOpen, setTwoFactorStartOpen] = useState(false);
    const [twoFactorOffOpen, setTwoFactorOffOpen] = useState(false);
    const [recoveryOpen, setRecoveryOpen] = useState(false);
    const [sessionsOpen, setSessionsOpen] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkEmployeeId, setLinkEmployeeId] = useState('');

    // El QR y los códigos llegan por flash una sola vez; a partir de ahí viven en estado
    // local porque ya no vuelven en ninguna respuesta.
    const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

    useEffect(() => {
        const incoming = flash?.two_factor_setup as TwoFactorSetup | undefined;
        if (incoming) {
            setSetup(incoming);
        }
    }, [flash?.two_factor_setup]);

    useEffect(() => {
        const incoming = flash?.two_factor_recovery_codes as string[] | undefined;
        if (incoming && incoming.length > 0) {
            setRecoveryCodes(incoming);
            setRecoveryOpen(true);
        }
    }, [flash?.two_factor_recovery_codes]);

    const save = useCallback(() => {
        setProcessing(true);
        router.patch(route('profile.update'), draft as never, {
            preserveScroll: true,
            onSuccess: () => {
                setErrors({});
                toast.success('Perfil actualizado', { duration: 2500 });
            },
            onError: (formErrors) => setErrors(formErrors as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    }, [draft]);

    const { security, sessions, user } = account;

    return (
        <>
            <div className="mx-auto w-full max-w-[920px] space-y-7">
                {/* ------------------------------------------------------ encabezado */}
                {!identityHandledElsewhere ? (
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-[24px] leading-tight" style={{ color: 'var(--emp-text)' }}>
                                Mi perfil
                            </h1>
                            <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                Cuenta administrativa. Aquí gestionas tu identidad y tu seguridad de acceso.
                            </p>
                        </div>
                        {user.role ? <StatusTag label={user.role.display_name} tone="accent" /> : null}
                    </header>
                ) : null}

                {/* ------------------------------------------------- aviso de vínculo */}
                {!account.employeeLinked ? (
                    <section className="emp-card flex flex-wrap items-start gap-3 p-4">
                        <span className="mt-0.5 shrink-0" style={{ color: 'var(--emp-muted)' }} aria-hidden="true">
                            <LinkIcon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                Tu cuenta no está vinculada a una ficha de empleado.
                            </p>
                            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--emp-muted)' }}>
                                Por eso no verás producción, nómina ni anticipos en esta pantalla.
                                {account.linking.reason ? ' '+account.linking.reason : ''}
                            </p>
                        </div>
                        {account.linking.canLink ? (
                            <button type="button" className="emp-btn emp-btn-sm emp-btn-primary shrink-0" onClick={() => setLinkOpen(true)}>
                                Vincular ficha
                            </button>
                        ) : null}
                    </section>
                ) : null}

                {/* ---------------------------------------------------------- identidad */}
                {!identityHandledElsewhere ? (
                    <section>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                                Identidad
                            </h2>
                            {dirty ? <StatusTag label="Sin guardar" tone="warn" /> : null}
                        </div>
                        <EmployeeFadingRule />

                        <div className="mt-3.5 space-y-4">
                            <AvatarUploader photoUrl={user.photoUrl} initials={user.initials} name={user.fullName} />

                            {/* Dos columnas fijas; por debajo de 620px, una. */}
                            <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2">
                                <EmpInput
                                    label="Nombre"
                                    required
                                    value={draft.name}
                                    onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
                                    error={errors.name}
                                />
                                <EmpInput
                                    label="Apellido"
                                    value={draft.last_name}
                                    onChange={(event) => setDraft((c) => ({ ...c, last_name: event.target.value }))}
                                    error={errors.last_name}
                                />
                                <EmpInput
                                    label="Teléfono"
                                    value={draft.phone}
                                    onChange={(event) => setDraft((c) => ({ ...c, phone: event.target.value }))}
                                    error={errors.phone}
                                    help="Usado para avisos de nómina y alertas."
                                />
                                <EmpInput
                                    label="Cargo"
                                    value={draft.job_title}
                                    onChange={(event) => setDraft((c) => ({ ...c, job_title: event.target.value }))}
                                    error={errors.job_title}
                                />
                            </div>
                        </div>
                    </section>
                ) : null}

                {/* --------------------------------------------------- acceso y seguridad */}
                <section id="seguridad">
                    <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                        Acceso y seguridad
                    </h2>
                    <EmployeeFadingRule />

                    <div className="mt-1.5">
                        <SecurityRow
                            icon={<EnvelopeSimple size={18} />}
                            label="Correo de inicio de sesión"
                            value={security.email}
                            tags={
                                security.emailVerifiedAt ? (
                                    <StatusTag label="Verificado" tone="accent" />
                                ) : (
                                    <StatusTag label="Sin verificar" tone="warn" />
                                )
                            }
                            hint={
                                security.pendingEmail
                                    ? `Pendiente de confirmar: ${security.pendingEmail}. Revisa esa bandeja; el correo actual sigue activo.`
                                    : undefined
                            }
                            actions={
                                <>
                                    {security.pendingEmail ? (
                                        <button
                                            type="button"
                                            className="emp-btn emp-btn-sm emp-btn-ghost"
                                            onClick={() => router.delete(route('profile.email.cancel'), { preserveScroll: true })}
                                        >
                                            Cancelar
                                        </button>
                                    ) : null}
                                    <button type="button" className="emp-btn emp-btn-sm" onClick={() => setEmailOpen(true)}>
                                        Cambiar
                                    </button>
                                </>
                            }
                        />

                        <SecurityRow
                            icon={<Key size={18} />}
                            label="Contraseña"
                            value={passwordAgeLabel(security.passwordAgeDays)}
                            tags={
                                <>
                                    {security.passwordIsStale ? <StatusTag label="Antigua" tone="warn" /> : null}
                                    {security.passwordChangeRequired ? <StatusTag label="Cambio obligatorio" tone="warn" /> : null}
                                </>
                            }
                            hint={
                                security.passwordIsStale
                                    ? `Recomendamos cambiarla al menos cada ${security.passwordStaleAfterDays} días.`
                                    : undefined
                            }
                            actions={
                                <button type="button" className="emp-btn emp-btn-sm" onClick={() => setPasswordOpen(true)}>
                                    Cambiar contraseña
                                </button>
                            }
                        />

                        <SecurityRow
                            icon={<ShieldCheck size={18} />}
                            label="Verificación en dos pasos"
                            value={security.twoFactorEnabled ? 'Activa' : 'Desactivada'}
                            tags={
                                security.twoFactorEnabled ? (
                                    <StatusTag label="Protegida" tone="ok" />
                                ) : security.twoFactorPending ? (
                                    <StatusTag label="Activación a medias" tone="warn" />
                                ) : (
                                    <StatusTag label="Sin segundo factor" tone="neutral" />
                                )
                            }
                            hint={
                                security.twoFactorEnabled
                                    ? `Te quedan ${security.recoveryCodesLeft} código(s) de respaldo.`
                                    : 'Añade un código temporal además de la contraseña al iniciar sesión.'
                            }
                            actions={
                                security.twoFactorEnabled ? (
                                    <>
                                        <button
                                            type="button"
                                            className="emp-btn emp-btn-sm"
                                            onClick={() => setTwoFactorStartOpen(true)}
                                        >
                                            Códigos nuevos
                                        </button>
                                        <button
                                            type="button"
                                            className="emp-btn emp-btn-sm emp-btn-danger"
                                            onClick={() => setTwoFactorOffOpen(true)}
                                        >
                                            Desactivar
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" className="emp-btn emp-btn-sm emp-btn-primary" onClick={() => setTwoFactorStartOpen(true)}>
                                        Activar
                                    </button>
                                )
                            }
                        />
                    </div>
                </section>

                {/* -------------------------------------------------- actividad reciente */}
                <section id="actividad">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                            Actividad reciente
                        </h2>
                        {account.sessionsSupported && sessions.length > 1 ? (
                            <button
                                type="button"
                                className="emp-btn emp-btn-sm ml-auto"
                                onClick={() => setSessionsOpen(true)}
                            >
                                <SignOut size={14} aria-hidden="true" /> Cerrar las demás sesiones
                            </button>
                        ) : null}
                    </div>
                    <EmployeeFadingRule />

                    {!account.sessionsSupported ? (
                        <p className="mt-3.5 text-[12.5px]" style={{ color: 'var(--emp-subtle)' }}>
                            El servidor no guarda las sesiones en base de datos, así que no se pueden listar ni cerrar
                            desde aquí.
                        </p>
                    ) : sessions.length === 0 ? (
                        <p className="mt-3.5 text-[12.5px]" style={{ color: 'var(--emp-subtle)' }}>
                            No hay sesiones registradas.
                        </p>
                    ) : (
                        <>
                            <ul className="mt-1.5">
                                {sessions.map((session) => (
                                    <li key={session.key}>
                                        <SessionRow session={session} />
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2.5 text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                Si algo no fuiste tú, cambia tu contraseña de inmediato.
                            </p>
                        </>
                    )}
                </section>

                {/* ------------------------------------------- preferencias de notificación */}
                <section id="notificaciones">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <h2 className="text-[15px]" style={{ color: 'var(--emp-text)' }}>
                            Preferencias de notificación
                        </h2>
                        {dirty ? <StatusTag label="Sin guardar" tone="warn" /> : null}
                    </div>
                    <EmployeeFadingRule />

                    <ul className="mt-1.5">
                        {account.preferenceCatalogue.map((item) => (
                            <li key={item.key} className="emp-row-sep py-3 last:border-b-0">
                                <label className="flex cursor-pointer items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 shrink-0"
                                        checked={draft.preferences[item.key] ?? false}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                preferences: { ...current.preferences, [item.key]: event.target.checked },
                                            }))
                                        }
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                            {item.label}
                                        </span>
                                        <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                                            {item.description}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Hueco para que la barra fija nunca tape la última sección. */}
                {dirty ? <div aria-hidden="true" className="h-16" /> : null}
            </div>

            <DirtyBar
                dirty={dirty}
                processing={processing}
                onDiscard={() => {
                    setDraft(original);
                    setErrors({});
                }}
                onSave={save}
            />

            {/* ------------------------------------------------------------- diálogos */}
            <ReauthDialog
                open={emailOpen}
                onClose={() => setEmailOpen(false)}
                onOpen={() => setNewEmail('')}
                title="Cambiar el correo de inicio de sesión"
                description="Te enviaremos un enlace al correo nuevo. El actual sigue activo hasta que lo confirmes."
                action={route('profile.email.update')}
                method="patch"
                confirmLabel="Enviar enlace"
                payload={() => ({ email: newEmail })}
                fields={({ errors: dialogErrors }) => (
                    <EmpInput
                        label="Correo nuevo"
                        type="email"
                        required
                        autoComplete="email"
                        value={newEmail}
                        onChange={(event) => setNewEmail(event.target.value)}
                        error={dialogErrors.email}
                    />
                )}
            />

            <ReauthDialog
                open={passwordOpen}
                onClose={() => setPasswordOpen(false)}
                onOpen={() => {
                    setNewPassword('');
                    setNewPasswordConfirm('');
                }}
                title="Cambiar contraseña"
                description="Al cambiarla se cierran las sesiones abiertas en otros dispositivos."
                action={route('profile.password.update')}
                method="put"
                confirmLabel="Cambiar contraseña"
                payload={() => ({ password: newPassword, password_confirmation: newPasswordConfirm })}
                fields={({ errors: dialogErrors }) => (
                    <>
                        <EmpInput
                            label="Contraseña nueva"
                            type="password"
                            required
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            error={dialogErrors.password}
                            help="Mínimo 8 caracteres, con letras y números."
                        />
                        <EmpInput
                            label="Repite la contraseña nueva"
                            type="password"
                            required
                            autoComplete="new-password"
                            value={newPasswordConfirm}
                            onChange={(event) => setNewPasswordConfirm(event.target.value)}
                            error={dialogErrors.password_confirmation}
                        />
                    </>
                )}
            />

            {/* Activar y regenerar códigos comparten ruta de reautenticación distinta. */}
            <ReauthDialog
                open={twoFactorStartOpen}
                onClose={() => setTwoFactorStartOpen(false)}
                title={security.twoFactorEnabled ? 'Generar códigos de respaldo nuevos' : 'Activar verificación en dos pasos'}
                description={
                    security.twoFactorEnabled
                        ? 'Los códigos actuales dejarán de servir.'
                        : 'Después te mostraremos el código QR y los códigos de respaldo.'
                }
                action={security.twoFactorEnabled ? route('profile.two-factor.recovery-codes') : route('profile.two-factor.store')}
                method="post"
                confirmLabel="Continuar"
            />

            <ReauthDialog
                open={twoFactorOffOpen}
                onClose={() => setTwoFactorOffOpen(false)}
                title="Desactivar verificación en dos pasos"
                description="Tu cuenta volverá a entrar solo con la contraseña."
                action={route('profile.two-factor.destroy')}
                method="delete"
                confirmLabel="Desactivar"
                danger
            />

            <TwoFactorSetupDialog open={setup !== null} setup={setup} onClose={() => setSetup(null)} />

            <RecoveryCodesDialog
                open={recoveryOpen}
                codes={recoveryCodes}
                onClose={() => {
                    setRecoveryOpen(false);
                    setRecoveryCodes([]);
                }}
            />

            <ReauthDialog
                open={sessionsOpen}
                onClose={() => setSessionsOpen(false)}
                title="Cerrar las demás sesiones"
                description="Solo seguirá abierta la de este dispositivo."
                action={route('profile.sessions.destroy')}
                method="delete"
                confirmLabel="Cerrar las demás"
                danger
            />

            <ReauthDialog
                open={linkOpen}
                onClose={() => setLinkOpen(false)}
                onOpen={() => setLinkEmployeeId('')}
                title="Vincular tu cuenta a una ficha"
                description="Solo aparecen las fichas de tu empresa que todavía no tienen cuenta de acceso."
                action={route('profile.link-employee')}
                method="post"
                confirmLabel="Vincular"
                payload={() => ({ employee_id: linkEmployeeId })}
                fields={({ errors: dialogErrors }) => (
                    <EmpSelect
                        label="Ficha de empleado"
                        required
                        placeholder="Selecciona…"
                        value={linkEmployeeId}
                        onChange={(event) => setLinkEmployeeId(event.target.value)}
                        options={account.linking.candidates.map((row) => ({
                            value: String(row.id),
                            label: `${row.full_name} · ${row.document}`,
                        }))}
                        error={dialogErrors.employee_id}
                    />
                )}
            />
        </>
    );
}

function SessionRow({ session }: { session: AccountSession }) {
    const Icon = session.device === 'Teléfono' ? DeviceMobile : session.device === 'Tableta' ? DeviceTablet : Desktop;

    return (
        <div className="emp-row-sep flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 last:border-b-0">
            <span className="shrink-0" style={{ color: 'var(--emp-muted)' }} aria-hidden="true">
                <Icon size={18} />
            </span>

            <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
                <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                    {session.device} · {session.browser}
                    <span style={{ color: 'var(--emp-subtle)' }}> ({session.platform})</span>
                </p>
                <p className="text-[12px]" style={{ color: 'var(--emp-subtle)' }}>
                    {session.location} · {formatDateTime(session.last_activity)}
                </p>
            </div>

            <StatusTag
                label={session.is_current ? 'Esta sesión' : session.is_active ? 'Activa' : 'Cerrada'}
                tone={session.is_current ? 'accent' : session.is_active ? 'ok' : 'neutral'}
            />
        </div>
    );
}

/** «Actualizada hace N meses» con la unidad que toque; nunca un texto fijo. */
function passwordAgeLabel(days: number | null): string {
    if (days === null) {
        return 'Sin registro de cambio';
    }

    if (days <= 0) {
        return 'Actualizada hoy';
    }

    if (days === 1) {
        return 'Actualizada ayer';
    }

    if (days < 30) {
        return `Actualizada hace ${days} días`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `Actualizada hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }

    const years = Math.floor(months / 12);

    return `Actualizada hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

export default AccountScreen;
