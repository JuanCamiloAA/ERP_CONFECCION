import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    BanknotesIcon,
    CalendarIcon,
    ClipboardDocumentListIcon,
    EnvelopeIcon,
    FingerPrintIcon,
    KeyIcon,
    LockClosedIcon,
    LockOpenIcon,
    PencilSquareIcon,
    PhoneIcon,
    ShieldCheckIcon,
    UserCircleIcon,
    UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/Components/UI/Avatar';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Tabs } from '@/Components/UI/Tabs';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import { Can } from '@/Components/UI/Can';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatDateTime, generatePassword, formatRoleSelectLabel } from '@/lib/utils';
import type { Advance, Employee, PayrollEmployee, Production } from '@/types';

function maskAccountDisplay(num: string | null | undefined): string {
    if (!num) return '—';
    if (num.length <= 4) return '****';
    return `${'*'.repeat(Math.min(6, num.length - 4))}${num.slice(-4)}`;
}

function maskKeyDisplay(key: string | null | undefined): string {
    if (!key) return '—';
    if (key.length <= 4) return '****';
    return `${'*'.repeat(Math.min(4, key.length - 4))}${key.slice(-4)}`;
}

interface MonthSummary {
    total_quantity: number;
    total_value: number;
    days_worked: number;
}

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company?: { id: number; name: string } | null;
}

interface Props {
    employee: Employee & { user?: { id: number; email: string; is_active: boolean; last_login_at: string | null; roles?: { id: number; name: string; display_name: string; color: string }[] } | null };
    productions: Production[];
    monthSummary: MonthSummary;
    advances: Advance[];
    payrolls: PayrollEmployee[];
    roles: RoleOption[];
}

type TabKey = 'info' | 'production' | 'payroll' | 'access';

export default function EmployeeShow({ employee, productions, monthSummary, advances, payrolls, roles }: Props) {
    const page = usePage();
    const flash = (page.props as unknown as App.PageProps).flash;
    const [tab, setTab] = useState<TabKey>('info');

    const [accessModal, setAccessModal] = useState(false);
    const [roleModal, setRoleModal] = useState(false);
    const [resetConfirm, setResetConfirm] = useState(false);
    const [toggleConfirm, setToggleConfirm] = useState(false);

    const [accessEmail, setAccessEmail] = useState(employee.email ?? '');
    const [accessPassword, setAccessPassword] = useState(() => generatePassword(10));
    const [accessRoleId, setAccessRoleId] = useState(roles.find((r) => r.name === 'operario_produccion')?.id ?? roles[0]?.id ?? '');
    const [newRoleId, setNewRoleId] = useState(employee.user?.roles?.[0]?.id ?? roles[0]?.id ?? '');

    useEffect(() => {
        if (flash?.temporary_password) {
            toast.success('Contrasena generada', {
                description: `Anota esta contrasena, no se mostrara de nuevo: ${flash.temporary_password}`,
                duration: 30000,
            });
        }
    }, [flash?.temporary_password]);

    const submitAccess = () => {
        router.post(route('employees.access.store', employee.id), {
            email: accessEmail,
            role_id: accessRoleId,
        }, {
            onSuccess: () => setAccessModal(false),
        });
    };

    const submitRoleChange = () => {
        router.post(route('employees.access.role', employee.id), {
            role_id: newRoleId,
        }, {
            onSuccess: () => setRoleModal(false),
        });
    };

    const handleToggleAccess = () => {
        router.post(route('employees.access.toggle', employee.id), {}, {
            onFinish: () => setToggleConfirm(false),
        });
    };

    const handleResetPassword = () => {
        router.post(route('employees.access.reset-password', employee.id), {}, {
            onFinish: () => setResetConfirm(false),
        });
    };

    const userRole = employee.user?.roles?.[0] ?? null;

    return (
        <AppLayout title={employee.full_name}>
            <Head title={employee.full_name} />

            <div className="space-y-6">
                <PageHeader
                    title={employee.full_name}
                    breadcrumbs={[
                        { label: 'Empleados', href: route('employees.index') },
                        { label: employee.full_name },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('employees.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Volver
                                </Button>
                            </Link>
                            <Link href={route('employees.edit', employee.id)}>
                                <Button icon={<PencilSquareIcon className="h-4 w-4" />}>Editar</Button>
                            </Link>
                        </div>
                    }
                />

                <Card>
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                        <Avatar src={employee.photo} name={employee.full_name} size="xl" />
                        <div className="flex-1 text-center sm:text-left">
                            <div className="flex flex-col items-center gap-2 sm:flex-row">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{employee.full_name}</h2>
                                <Badge variant={employee.is_active ? 'success' : 'danger'}>
                                    {employee.is_active ? 'Activo' : 'Inactivo'}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                                {employee.document_type} {employee.document_number}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400 sm:justify-start">
                                {employee.phone && (
                                    <span className="flex items-center gap-1">
                                        <PhoneIcon className="h-4 w-4" />
                                        {employee.phone}
                                    </span>
                                )}
                                {employee.email && (
                                    <span className="flex items-center gap-1">
                                        <EnvelopeIcon className="h-4 w-4" />
                                        {employee.email}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-4 w-4" />
                                    Ingreso: {formatDate(employee.hire_date)}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Tabs
                    active={tab}
                    onChange={(k) => setTab(k as TabKey)}
                    tabs={[
                        { key: 'info', label: 'Informacion', icon: <UserCircleIcon className="h-4 w-4" /> },
                        { key: 'production', label: 'Produccion', icon: <ClipboardDocumentListIcon className="h-4 w-4" /> },
                        { key: 'payroll', label: 'Pagos', icon: <BanknotesIcon className="h-4 w-4" /> },
                        { key: 'access', label: 'Cuenta de acceso', icon: <ShieldCheckIcon className="h-4 w-4" /> },
                    ]}
                />

                {tab === 'info' && (
                    <Card>
                        <CardHeader title="Informacion personal" />
                        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Modalidad nomina</dt>
                                <dd className="mt-1 text-sm capitalize text-slate-700 dark:text-slate-300">
                                    {employee.payroll_mode === 'fixed_daily' ? 'Salario diario' : 'Por operaciones'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Banco</dt>
                                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                    {employee.bank?.name ?? '—'}
                                    {employee.bank && !employee.bank.is_active ? (
                                        <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(inactivo)</span>
                                    ) : null}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Cuenta (enmascarada)</dt>
                                <dd className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{maskAccountDisplay(employee.bank_account_number ?? undefined)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Llave bancaria (enmascarada)</dt>
                                <dd className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{maskKeyDisplay(employee.bank_key ?? undefined)}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Direccion</dt>
                                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{employee.address ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase text-slate-500">Salario base</dt>
                                <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatCurrency(employee.base_salary)}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs uppercase text-slate-500">Notas</dt>
                                <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{employee.notes ?? '-'}</dd>
                            </div>
                        </dl>
                    </Card>
                )}

                {tab === 'production' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Card padding="sm">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Produccion del mes</p>
                                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(monthSummary.total_value)}</p>
                            </Card>
                            <Card padding="sm">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Unidades</p>
                                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{monthSummary.total_quantity}</p>
                            </Card>
                            <Card padding="sm">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Dias trabajados</p>
                                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{monthSummary.days_worked}</p>
                            </Card>
                        </div>
                        <Card>
                            <CardHeader title="Historial de produccion" description="Ultimos 50 registros" />
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-200 dark:border-slate-700">
                                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                            <th className="py-2">Fecha</th>
                                            <th className="py-2">Referencia</th>
                                            <th className="py-2">Operacion</th>
                                            <th className="py-2 text-right">Cantidad</th>
                                            <th className="py-2 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {productions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400">No hay registros</td>
                                            </tr>
                                        ) : (
                                            productions.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="py-2">{formatDate(p.date)}</td>
                                                    <td className="py-2">{p.reference?.code} - {p.reference?.name}</td>
                                                    <td className="py-2">{p.operation?.name}</td>
                                                    <td className="py-2 text-right">{p.quantity}</td>
                                                    <td className="py-2 text-right font-medium">{formatCurrency(p.total_value)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'payroll' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader title="Pagos por nomina" />
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-200 dark:border-slate-700">
                                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                            <th className="py-2">Periodo</th>
                                            <th className="py-2 text-right">Producido</th>
                                            <th className="py-2 text-right">Anticipos</th>
                                            <th className="py-2 text-right">Neto</th>
                                            <th className="py-2 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {payrolls.length === 0 ? (
                                            <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sin pagos registrados</td></tr>
                                        ) : (
                                            payrolls.map((row) => {
                                                const pr = (row as PayrollEmployee & { payroll?: { name: string; period_start: string; period_end: string; status: string } }).payroll;
                                                return (
                                                    <tr key={row.id}>
                                                        <td className="py-2">{pr?.name} <span className="text-xs text-slate-500">({formatDate(pr?.period_start)} - {formatDate(pr?.period_end)})</span></td>
                                                        <td className="py-2 text-right">{formatCurrency(row.production_total)}</td>
                                                        <td className="py-2 text-right">{formatCurrency(row.advances_discount)}</td>
                                                        <td className="py-2 text-right font-semibold">{formatCurrency(row.net_payment)}</td>
                                                        <td className="py-2 text-center">
                                                            <Badge variant={row.is_paid ? 'success' : 'warning'}>{row.is_paid ? 'Pagado' : 'Pendiente'}</Badge>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Anticipos" />
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-200 dark:border-slate-700">
                                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                            <th className="py-2">Fecha</th>
                                            <th className="py-2">Motivo</th>
                                            <th className="py-2 text-right">Monto</th>
                                            <th className="py-2 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {advances.length === 0 ? (
                                            <tr><td colSpan={4} className="py-6 text-center text-slate-400">Sin anticipos</td></tr>
                                        ) : (
                                            advances.map((a) => (
                                                <tr key={a.id}>
                                                    <td className="py-2">{formatDate(a.date)}</td>
                                                    <td className="py-2">{a.reason}</td>
                                                    <td className="py-2 text-right">{formatCurrency(a.amount)}</td>
                                                    <td className="py-2 text-center">
                                                        <Badge variant={a.status === 'descontado' ? 'success' : 'warning'}>{a.status}</Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {tab === 'access' && (
                    <Card>
                        <CardHeader
                            title="Cuenta de acceso al sistema"
                            description="Gestiona el usuario vinculado a este empleado"
                        />
                        <div className="mt-4">
                            {!employee.user_id || !employee.user ? (
                                <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30">
                                        <LockClosedIcon className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Este empleado no tiene acceso al sistema
                                    </p>
                                    <Button icon={<UserPlusIcon className="h-4 w-4" />} onClick={() => setAccessModal(true)}>
                                        Crear acceso
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {!employee.user.is_active && (
                                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                                            Esta cuenta esta desactivada. El empleado no puede ingresar al sistema.
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">Correo de acceso</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{employee.user.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">Ultimo acceso</p>
                                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                                {employee.user.last_login_at ? formatDateTime(employee.user.last_login_at) : 'Nunca'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">Rol asignado</p>
                                            <div className="mt-1">
                                                <RoleBadge role={userRole} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase text-slate-500">Estado</p>
                                            <div className="mt-1">
                                                <Badge variant={employee.user.is_active ? 'success' : 'danger'}>
                                                    {employee.user.is_active ? 'Activa' : 'Desactivada'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                                        {!employee.user?.roles?.some((r) => r.name === 'super_admin') && (
                                            <Can permission="users.edit.permission_overrides">
                                                <Link href={route('users.edit', employee.user!.id)}>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        icon={<FingerPrintIcon className="h-4 w-4" />}
                                                    >
                                                        Ajustar permisos individuales
                                                    </Button>
                                                </Link>
                                            </Can>
                                        )}
                                        <Button variant="outline" icon={<ShieldCheckIcon className="h-4 w-4" />} onClick={() => setRoleModal(true)}>
                                            Cambiar rol
                                        </Button>
                                        <Button variant="outline" icon={<KeyIcon className="h-4 w-4" />} onClick={() => setResetConfirm(true)}>
                                            Restablecer contrasena
                                        </Button>
                                        <Button
                                            variant={employee.user.is_active ? 'danger' : 'success'}
                                            icon={employee.user.is_active ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
                                            onClick={() => setToggleConfirm(true)}
                                        >
                                            {employee.user.is_active ? 'Desactivar acceso' : 'Activar acceso'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>

            <Modal
                open={accessModal}
                onClose={() => setAccessModal(false)}
                title="Crear acceso al sistema"
                description="Genera credenciales para que el empleado pueda ingresar"
                size="lg"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setAccessModal(false)}>Cancelar</Button>
                        <Button onClick={submitAccess}>Crear acceso</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Correo de acceso" type="email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} required />
                    <Select
                        label="Rol asignado"
                        value={accessRoleId}
                        onChange={(e) => setAccessRoleId(Number(e.target.value))}
                        options={roles.map((r) => ({ value: r.id, label: formatRoleSelectLabel(r) }))}
                        required
                    />
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Contrasena temporal</label>
                        <div className="flex gap-2">
                            <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900">
                                {accessPassword}
                            </div>
                            <Button type="button" variant="outline" onClick={() => setAccessPassword(generatePassword(10))}>
                                Regenerar
                            </Button>
                        </div>
                        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                            La contrasena solo se mostrara una vez al crear la cuenta.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal
                open={roleModal}
                onClose={() => setRoleModal(false)}
                title="Cambiar rol"
                size="md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRoleModal(false)}>Cancelar</Button>
                        <Button onClick={submitRoleChange}>Cambiar</Button>
                    </>
                }
            >
                <Select
                    label="Nuevo rol"
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(Number(e.target.value))}
                    options={roles.map((r) => ({ value: r.id, label: formatRoleSelectLabel(r) }))}
                />
            </Modal>

            <ConfirmDialog
                open={resetConfirm}
                onClose={() => setResetConfirm(false)}
                onConfirm={handleResetPassword}
                title="Restablecer contrasena"
                message="Se generara una nueva contrasena temporal y se forzara cambio en el siguiente ingreso."
                confirmText="Restablecer"
                variant="primary"
            />

            <ConfirmDialog
                open={toggleConfirm}
                onClose={() => setToggleConfirm(false)}
                onConfirm={handleToggleAccess}
                title={employee.user?.is_active ? 'Desactivar acceso' : 'Activar acceso'}
                message={employee.user?.is_active
                    ? 'El empleado no podra ingresar al sistema mientras la cuenta este desactivada.'
                    : 'Permitir que el empleado vuelva a ingresar al sistema.'}
                confirmText={employee.user?.is_active ? 'Desactivar' : 'Activar'}
                variant={employee.user?.is_active ? 'danger' : 'success'}
            />
        </AppLayout>
    );
}
