import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PermissionOverrideMatrix, type OverrideRow } from '@/Components/Permissions/PermissionOverrideMatrix';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';
import { generatePassword, formatRoleSelectLabel } from '@/lib/utils';
import type { PermissionMatrix as MatrixType } from '@/types';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    company?: { id: number; name: string } | null;
}

interface CompanyOption {
    id: number;
    name: string;
}

interface UserData {
    id: number;
    name: string;
    last_name: string | null;
    email: string;
    phone: string | null;
    is_active: boolean;
    company_id: number | null;
    roles: { id: number; name: string }[];
}

interface Props {
    user: UserData;
    roles: RoleOption[];
    companies: CompanyOption[];
    permission_matrix: MatrixType;
    role_permissions: string[];
    permission_overrides: { permission: string; effect: string }[];
    can_manage_permission_overrides: boolean;
}

export default function UserEdit({
    user,
    roles,
    companies,
    permission_matrix,
    role_permissions,
    permission_overrides,
    can_manage_permission_overrides,
}: Props) {
    const currentRoleId = user.roles.length > 0 ? user.roles[0].id : ('' as number | '');

    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        last_name: user.last_name ?? '',
        email: user.email,
        phone: user.phone ?? '',
        password: '',
        password_confirmation: '',
        role_id: currentRoleId,
        company_id: (user.company_id ?? '') as number | '',
        is_active: user.is_active,
    });

    const initialOverrides = useMemo<OverrideRow[]>(
        () =>
            permission_overrides
                .filter((o) => o.effect === 'grant' || o.effect === 'deny')
                .map((o) => ({ permission: o.permission, effect: o.effect as 'grant' | 'deny' })),
        [permission_overrides],
    );

    const [overrideRows, setOverrideRows] = useState<OverrideRow[]>(initialOverrides);
    const [confirmClearOverrides, setConfirmClearOverrides] = useState(false);
    const [savingOverrides, setSavingOverrides] = useState(false);

    useEffect(() => {
        setOverrideRows(initialOverrides);
    }, [initialOverrides]);

    const isTargetSuperAdmin = user.roles.some((r) => r.name === 'super_admin');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id));
    };

    const saveOverrides = () => {
        setSavingOverrides(true);
        router.put(
            route('users.permission-overrides.update', user.id),
            { overrides: overrideRows },
            {
                preserveScroll: true,
                onFinish: () => setSavingOverrides(false),
                onSuccess: () => router.reload({ only: ['auth'] }),
            },
        );
    };

    const clearOverrides = () => {
        setSavingOverrides(true);
        router.put(
            route('users.permission-overrides.update', user.id),
            { clear_all: true },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSavingOverrides(false);
                    setConfirmClearOverrides(false);
                },
                onSuccess: () => {
                    setOverrideRows([]);
                    router.reload({ only: ['auth'] });
                },
            },
        );
    };

    const generate = () => {
        const pwd = generatePassword(12);
        setData((d) => ({ ...d, password: pwd, password_confirmation: pwd }));
    };

    return (
        <AppLayout title={`Editar ${user.name}`}>
            <Head title={`Editar ${user.name}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${user.name}`}
                    breadcrumbs={[{ label: 'Usuarios', href: route('users.index') }, { label: user.name }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('users.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Guardar cambios</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos del usuario" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input label="Apellido" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} />
                        <Input type="email" label="Correo electronico" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} required />
                        <Input label="Telefono" value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                        <Select
                            label="Rol"
                            value={data.role_id}
                            onChange={(e) => setData('role_id', e.target.value ? Number(e.target.value) : '')}
                            error={errors.role_id}
                            placeholder="Selecciona un rol"
                            options={roles.map((r) => ({ value: r.id, label: formatRoleSelectLabel(r) }))}
                            required
                        />
                        {companies.length > 0 && (
                            <Select
                                label="Empresa"
                                value={data.company_id}
                                onChange={(e) => setData('company_id', e.target.value ? Number(e.target.value) : '')}
                                error={errors.company_id}
                                placeholder="Sin empresa"
                                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                            />
                        )}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Cambiar contrasena (opcional)"
                        action={
                            <Button type="button" variant="ghost" size="sm" icon={<ArrowPathIcon className="h-4 w-4" />} onClick={generate}>
                                Generar
                            </Button>
                        }
                    />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input type="text" label="Nueva contrasena" value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password} description="Deja en blanco para no modificar" />
                        <Input type="text" label="Confirmar contrasena" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} />
                    </div>
                </Card>

                <Card>
                    <CardHeader title="Estado" />
                    <div className="mt-4">
                        <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Usuario activo" />
                    </div>
                </Card>

                {can_manage_permission_overrides && !isTargetSuperAdmin && (
                    <Card>
                        <CardHeader
                            title="Permisos individuales (excepciones)"
                            description="Los cambios solo afectan a este usuario. La definicion del rol en la matriz de roles no se modifica."
                            action={
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmClearOverrides(true)} disabled={savingOverrides}>
                                        Restablecer excepciones
                                    </Button>
                                    <Button type="button" size="sm" loading={savingOverrides} onClick={saveOverrides}>
                                        Guardar excepciones
                                    </Button>
                                </div>
                            }
                        />
                        <div className="mt-4">
                            <PermissionOverrideMatrix
                                matrix={permission_matrix}
                                rolePermissions={role_permissions}
                                value={overrideRows}
                                onChange={setOverrideRows}
                                disabled={savingOverrides}
                            />
                        </div>
                    </Card>
                )}
            </form>

            <ConfirmDialog
                open={confirmClearOverrides}
                onClose={() => setConfirmClearOverrides(false)}
                onConfirm={clearOverrides}
                title="Restablecer excepciones"
                message="Se eliminaran todas las excepciones de permisos para este usuario. El acceso quedara solo segun el rol asignado."
                confirmText="Restablecer"
                variant="danger"
                loading={savingOverrides}
            />
        </AppLayout>
    );
}
