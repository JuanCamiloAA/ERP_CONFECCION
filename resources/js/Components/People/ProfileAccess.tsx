import { Link, router } from '@inertiajs/react';
import { Fingerprint, Key, LockKey, LockKeyOpen, ShieldCheck, UserPlus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    AccessPasswordData,
    AccessPasswordFields,
    createAccessPasswordData,
} from '@/Components/Employees/AccessPasswordFields';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Checkbox } from '@/Components/UI/Checkbox';
import { collectUnmappedErrors, FormErrorAlert } from '@/Components/UI/FormErrorAlert';
import { EmpInput, EmpSelect } from '@/Components/UI/ModuleFields';
import { Modal } from '@/Components/UI/Modal';
import { formatDateTime } from '@/lib/utils';
import type { EmployeeProfile } from '@/types';
import { DataRow, Empty, StatusTag } from './primitives';

/** Campos que el modal de acceso sabe mostrar; el resto se avisa en la alerta de arriba. */
const ACCESS_FIELD_KEYS = [
    'email',
    'role_id',
    'password_mode',
    'user_password',
    'user_password_confirmation',
    'require_password_change',
];

/**
 * Cuenta de acceso al sistema.
 *
 * Ya no es una pestaña aparte: es un bloque más de la ficha, y las mismas acciones se
 * disparan desde la alerta de «sin acceso» de la cabecera. `openCreate` es la señal que
 * llega desde allí —por eso el estado del modal se controla desde fuera además de desde
 * el propio bloque.
 */
export function ProfileAccess({
    profile,
    openCreate,
    onOpenCreateHandled,
}: {
    profile: EmployeeProfile;
    openCreate: boolean;
    onOpenCreateHandled: () => void;
}) {
    const { account, options, permissions, contact, employeeId } = profile;

    const [createOpen, setCreateOpen] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [toggleOpen, setToggleOpen] = useState(false);

    const [email, setEmail] = useState(contact.email ?? '');
    const [password, setPassword] = useState<AccessPasswordData>(createAccessPasswordData);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [roleId, setRoleId] = useState<string>(() => {
        const operator = options.roles.find((row) => row.name === 'operario_produccion');

        return String(operator?.id ?? options.roles[0]?.id ?? '');
    });
    const [newRoleId, setNewRoleId] = useState<string>(String(account.role?.id ?? options.roles[0]?.id ?? ''));
    const [requireChange, setRequireChange] = useState(true);

    // La alerta de la cabecera abre este mismo modal: sin esto habría dos formularios
    // distintos para crear la misma cuenta.
    useEffect(() => {
        if (openCreate) {
            setPassword(createAccessPasswordData());
            setErrors({});
            setCreateOpen(true);
            onOpenCreateHandled();
        }
    }, [openCreate, onOpenCreateHandled]);

    const submitCreate = () => {
        router.post(
            route('employees.access.store', employeeId),
            { email, role_id: roleId, ...password },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCreateOpen(false);
                    setErrors({});
                },
                onError: (formErrors) => {
                    setErrors(formErrors as Record<string, string>);
                    const blocking = collectUnmappedErrors(formErrors, ACCESS_FIELD_KEYS);
                    if (blocking.length > 0) {
                        toast.error(blocking[0]);
                    }
                },
            },
        );
    };

    return (
        <>
            {!account.exists ? (
                <div className="emp-card flex flex-col items-center gap-3 p-6 text-center">
                    <span style={{ color: 'var(--emp-muted)' }} aria-hidden="true">
                        <LockKey size={28} />
                    </span>
                    <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                        Esta persona no tiene cuenta de acceso al sistema
                    </p>
                    {permissions.canCreateAccess && permissions.canManageAccess ? (
                        <button
                            type="button"
                            className="emp-btn emp-btn-primary"
                            onClick={() => {
                                setPassword(createAccessPasswordData());
                                setErrors({});
                                setCreateOpen(true);
                            }}
                        >
                            <UserPlus size={15} aria-hidden="true" /> Crear acceso
                        </button>
                    ) : null}
                </div>
            ) : (
                <div className="space-y-3.5">
                    {!account.is_active ? (
                        <p className="emp-note" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                            La cuenta está desactivada: la persona no puede ingresar al sistema.
                        </p>
                    ) : null}

                    <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <DataRow label="Correo de acceso">{account.email ?? <Empty />}</DataRow>
                        <DataRow label="Último acceso">
                            {account.last_login_at ? formatDateTime(account.last_login_at) : 'Nunca'}
                        </DataRow>
                        <DataRow label="Rol asignado">
                            {account.role ? <StatusTag label={account.role.display_name} tone="accent" /> : <Empty />}
                        </DataRow>
                        <DataRow label="Estado">
                            <StatusTag label={account.status_label} tone={account.is_active ? 'ok' : 'warn'} />
                        </DataRow>
                    </dl>

                    {permissions.canManageAccess ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {account.user_id && account.role?.name !== 'super_admin' ? (
                                <Can permission="users.edit.permission_overrides">
                                    <Link href={route('users.edit', account.user_id)} className="emp-btn emp-btn-sm">
                                        <Fingerprint size={14} aria-hidden="true" /> Permisos individuales
                                    </Link>
                                </Can>
                            ) : null}
                            {permissions.canChangeRole ? (
                                <button type="button" className="emp-btn emp-btn-sm" onClick={() => setRoleOpen(true)}>
                                    <ShieldCheck size={14} aria-hidden="true" /> Cambiar rol
                                </button>
                            ) : null}
                            {permissions.canResetPassword ? (
                                <button type="button" className="emp-btn emp-btn-sm" onClick={() => setResetOpen(true)}>
                                    <Key size={14} aria-hidden="true" /> Restablecer contraseña
                                </button>
                            ) : null}
                            {permissions.canToggleAccess ? (
                                <button
                                    type="button"
                                    className={`emp-btn emp-btn-sm ${account.is_active ? 'emp-btn-danger' : ''}`}
                                    onClick={() => setToggleOpen(true)}
                                >
                                    {account.is_active ? (
                                        <>
                                            <LockKey size={14} aria-hidden="true" /> Desactivar acceso
                                        </>
                                    ) : (
                                        <>
                                            <LockKeyOpen size={14} aria-hidden="true" /> Activar acceso
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}

            {/* ------------------------------------------------------ crear acceso */}
            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Crear acceso al sistema"
                description="Genera credenciales para que la persona pueda ingresar."
                size="lg"
                sheetOnMobile
                footer={
                    <>
                        <button type="button" className="emp-btn emp-btn-ghost" onClick={() => setCreateOpen(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="emp-btn emp-btn-primary" onClick={submitCreate}>
                            Crear acceso
                        </button>
                    </>
                }
            >
                <div className="emp-scope space-y-3.5">
                    <FormErrorAlert
                        messages={collectUnmappedErrors(errors, ACCESS_FIELD_KEYS)}
                        title="No se pudo crear el acceso"
                    />
                    <EmpInput
                        label="Correo de acceso"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        error={errors.email}
                    />
                    <EmpSelect
                        label="Rol asignado"
                        required
                        value={roleId}
                        onChange={(event) => setRoleId(event.target.value)}
                        options={options.roles.map((row) => ({ value: String(row.id), label: row.display_name }))}
                        error={errors.role_id}
                    />
                    <AccessPasswordFields
                        value={password}
                        onChange={(patch) => setPassword((current) => ({ ...current, ...patch }))}
                        errors={{
                            password_mode: errors.password_mode,
                            user_password: errors.user_password,
                            user_password_confirmation: errors.user_password_confirmation,
                            require_password_change: errors.require_password_change,
                        }}
                    />
                </div>
            </Modal>

            {/* ------------------------------------------------------- cambiar rol */}
            <Modal
                open={roleOpen}
                onClose={() => setRoleOpen(false)}
                title="Cambiar rol"
                description="Cambia lo que la persona puede ver y hacer en todo el sistema."
                size="md"
                footer={
                    <>
                        <button type="button" className="emp-btn emp-btn-ghost" onClick={() => setRoleOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="emp-btn emp-btn-primary"
                            onClick={() =>
                                router.post(
                                    route('employees.access.role', employeeId),
                                    { role_id: newRoleId },
                                    { preserveScroll: true, onSuccess: () => setRoleOpen(false) },
                                )
                            }
                        >
                            Cambiar
                        </button>
                    </>
                }
            >
                <div className="emp-scope">
                    <EmpSelect
                        label="Nuevo rol"
                        value={newRoleId}
                        onChange={(event) => setNewRoleId(event.target.value)}
                        options={options.roles.map((row) => ({ value: String(row.id), label: row.display_name }))}
                    />
                </div>
            </Modal>

            {/* --------------------------------------------- restablecer contraseña */}
            <Modal
                open={resetOpen}
                onClose={() => setResetOpen(false)}
                title="Restablecer contraseña"
                size="md"
                footer={
                    <>
                        <button type="button" className="emp-btn emp-btn-ghost" onClick={() => setResetOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="emp-btn emp-btn-primary"
                            onClick={() =>
                                router.post(
                                    route('employees.access.reset-password', employeeId),
                                    { require_password_change: requireChange },
                                    { preserveScroll: true, onFinish: () => setResetOpen(false) },
                                )
                            }
                        >
                            Restablecer
                        </button>
                    </>
                }
            >
                <div className="emp-scope space-y-3.5">
                    <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        Se generará una contraseña temporal y se mostrará una sola vez.
                    </p>
                    <Checkbox
                        checked={requireChange}
                        onChange={(event) => setRequireChange(event.target.checked)}
                        label="Exigir cambio de contraseña en el primer ingreso"
                        description="La persona deberá definir una nueva antes de usar el sistema."
                    />
                </div>
            </Modal>

            <ConfirmDialog
                open={toggleOpen}
                onClose={() => setToggleOpen(false)}
                onConfirm={() =>
                    router.post(
                        route('employees.access.toggle', employeeId),
                        {},
                        { preserveScroll: true, onFinish: () => setToggleOpen(false) },
                    )
                }
                title={account.is_active ? 'Desactivar acceso' : 'Activar acceso'}
                message={
                    account.is_active
                        ? 'No podrá ingresar al sistema mientras la cuenta esté desactivada.'
                        : 'Permitir que vuelva a ingresar al sistema.'
                }
                confirmText={account.is_active ? 'Desactivar' : 'Activar'}
                variant={account.is_active ? 'danger' : 'success'}
            />
        </>
    );
}

export default ProfileAccess;
