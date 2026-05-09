import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathIcon, KeyIcon } from '@heroicons/react/24/outline';
import { FormEvent, useState } from 'react';
import { MembershipLimitAlert } from '@/Components/Membership/MembershipLimitAlert';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { generatePassword, formatRoleSelectLabel } from '@/lib/utils';

interface Role {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    company?: { id: number; name: string } | null;
}

interface BankOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface Props {
    roles: Role[];
    banks: BankOption[];
}

export default function EmployeeCreate({ roles, banks }: Props) {
    const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword(10));

    const { data, setData, post, processing, errors } = useForm({
        first_name: '',
        last_name: '',
        document_type: 'CC',
        document_number: '',
        phone: '',
        email: '',
        address: '',
        hire_date: new Date().toISOString().split('T')[0],
        photo: null as File | null,
        base_salary: '',
        payroll_mode: 'operations' as 'operations' | 'fixed_daily',
        daily_salary: '',
        minutes_per_full_workday: '480',
        is_active: true,
        notes: '',
        bank_id: '' as string | number,
        bank_account_number: '',
        bank_key: '',
        create_user_account: false,
        user_email: '',
        user_role_id: roles.find((r) => !r.is_system)?.id ?? roles[0]?.id ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('employees.store'), { forceFormData: true });
    };

    const regeneratePassword = () => setGeneratedPassword(generatePassword(10));

    return (
        <AppLayout title="Nuevo empleado">
            <Head title="Nuevo empleado" />

            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo empleado"
                    breadcrumbs={[
                        { label: 'Empleados', href: route('employees.index') },
                        { label: 'Nuevo' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('employees.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" loading={processing}>
                                Guardar empleado
                            </Button>
                        </div>
                    }
                />

                <MembershipLimitAlert />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader title="Datos personales" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombres"
                                value={data.first_name}
                                onChange={(e) => setData('first_name', e.target.value)}
                                error={errors.first_name}
                                required
                            />
                            <Input
                                label="Apellidos"
                                value={data.last_name}
                                onChange={(e) => setData('last_name', e.target.value)}
                                error={errors.last_name}
                                required
                            />
                            <Select
                                label="Tipo de documento"
                                value={data.document_type}
                                onChange={(e) => setData('document_type', e.target.value)}
                                error={errors.document_type}
                                options={[
                                    { value: 'CC', label: 'Cedula de ciudadania' },
                                    { value: 'CE', label: 'Cedula de extranjeria' },
                                    { value: 'TI', label: 'Tarjeta de identidad' },
                                    { value: 'PAS', label: 'Pasaporte' },
                                    { value: 'NIT', label: 'NIT' },
                                ]}
                                required
                            />
                            <Input
                                label="Numero de documento"
                                value={data.document_number}
                                onChange={(e) => setData('document_number', e.target.value)}
                                error={errors.document_number}
                                required
                            />
                            <Input
                                label="Telefono"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                            />
                            <Input
                                label="Correo personal"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={errors.email}
                            />
                            <Input
                                label="Direccion"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                error={errors.address}
                                containerClassName="sm:col-span-2"
                            />
                            <Input
                                label="Fecha de ingreso"
                                type="date"
                                value={data.hire_date}
                                onChange={(e) => setData('hire_date', e.target.value)}
                                error={errors.hire_date}
                                required
                            />
                            <Input
                                label="Salario base"
                                type="number"
                                step="0.01"
                                value={data.base_salary}
                                onChange={(e) => setData('base_salary', e.target.value)}
                                error={errors.base_salary}
                                prefix="$"
                            />
                            <Select
                                label="Modalidad de nomina"
                                value={data.payroll_mode}
                                onChange={(e) => setData('payroll_mode', e.target.value as 'operations' | 'fixed_daily')}
                                error={errors.payroll_mode}
                                options={[
                                    { value: 'operations', label: 'Por operaciones (produccion)' },
                                    { value: 'fixed_daily', label: 'Salario diario fijo (jornadas)' },
                                ]}
                                containerClassName="sm:col-span-2"
                            />
                            {data.payroll_mode === 'fixed_daily' && (
                                <>
                                    <Input
                                        label="Salario diario"
                                        type="number"
                                        step="0.01"
                                        value={data.daily_salary}
                                        onChange={(e) => setData('daily_salary', e.target.value)}
                                        error={errors.daily_salary}
                                        prefix="$"
                                        required
                                    />
                                    <Input
                                        label="Minutos jornada completa"
                                        type="number"
                                        min={1}
                                        value={data.minutes_per_full_workday}
                                        onChange={(e) => setData('minutes_per_full_workday', e.target.value)}
                                        error={errors.minutes_per_full_workday}
                                        description="Ej. 480 = 8 horas"
                                    />
                                </>
                            )}
                            <Textarea
                                label="Notas"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                error={errors.notes}
                                className="sm:col-span-2"
                                rows={3}
                            />
                            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700 sm:col-span-2">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Datos para pago</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Opcional. Si indica banco, numero de cuenta o llave, debe completar los tres campos. Cuenta: solo numeros. Llave: solo letras y numeros.
                                </p>
                                {banks.length === 0 ? (
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        No hay bancos activos en el catalogo.{' '}
                                        <Can permission="banks.index.create">
                                            <Link href={route('banks.create')} className="font-semibold underline">
                                                Registrar banco
                                            </Link>
                                        </Can>
                                    </p>
                                ) : (
                                    <Select
                                        label="Banco"
                                        value={data.bank_id === '' || data.bank_id === null ? '' : String(data.bank_id)}
                                        onChange={(e) => setData('bank_id', e.target.value === '' ? '' : Number(e.target.value))}
                                        error={errors.bank_id}
                                        options={banks.map((b) => ({ value: b.id, label: b.name }))}
                                        placeholder="Seleccione un banco"
                                    />
                                )}
                                <Input
                                    label="Numero de cuenta"
                                    value={data.bank_account_number}
                                    onChange={(e) => setData('bank_account_number', e.target.value.replace(/\D/g, ''))}
                                    error={errors.bank_account_number}
                                    description="Solo numeros"
                                />
                                <Input
                                    label="Llave bancaria"
                                    value={data.bank_key}
                                    onChange={(e) => setData('bank_key', e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
                                    error={errors.bank_key}
                                    description="Solo letras y numeros, sin espacios"
                                />
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader title="Estado y foto" />
                            <div className="mt-4 space-y-4">
                                <Switch
                                    checked={data.is_active}
                                    onChange={(v) => setData('is_active', v)}
                                    label="Empleado activo"
                                    description="Puede aparecer en registros de produccion"
                                />
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Foto
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setData('photo', e.target.files?.[0] ?? null)}
                                        className="w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                    />
                                    {errors.photo && <p className="mt-1 text-xs text-rose-500">{errors.photo}</p>}
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Acceso al sistema" description="Crear cuenta de usuario para este empleado" />
                            <div className="mt-4 space-y-4">
                                <Switch
                                    checked={data.create_user_account}
                                    onChange={(v) => {
                                        setData('create_user_account', v);
                                        if (v && !data.user_email && data.email) {
                                            setData('user_email', data.email);
                                        }
                                    }}
                                    label="Crear acceso"
                                    description="El empleado podra ingresar al sistema"
                                />

                                {data.create_user_account && (
                                    <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                                        <Input
                                            label="Correo de acceso"
                                            type="email"
                                            value={data.user_email}
                                            onChange={(e) => setData('user_email', e.target.value)}
                                            error={errors.user_email}
                                            required
                                        />
                                        <Select
                                            label="Rol"
                                            value={data.user_role_id}
                                            onChange={(e) => setData('user_role_id', Number(e.target.value))}
                                            error={errors.user_role_id}
                                            options={roles.map((r) => ({
                                                value: r.id,
                                                label: formatRoleSelectLabel(r),
                                                description: r.description ?? '',
                                            }))}
                                            required
                                        />
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Contrasena temporal
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                                    {generatedPassword}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={regeneratePassword}
                                                    icon={<ArrowPathIcon className="h-4 w-4" />}
                                                />
                                            </div>
                                            <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                                                <KeyIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                Esta contrasena solo se mostrara en este momento.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
