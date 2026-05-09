import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { MembershipLimitAlert } from '@/Components/Membership/MembershipLimitAlert';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';
import { generatePassword, formatRoleSelectLabel } from '@/lib/utils';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    company?: { id: number; name: string } | null;
}

interface CompanyOption {
    id: number;
    name: string;
}

interface Props {
    roles: RoleOption[];
    companies: CompanyOption[];
}

export default function UserCreate({ roles, companies }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        role_id: '' as number | '',
        company_id: '' as number | '',
        is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('users.store'));
    };

    const generate = () => {
        const pwd = generatePassword(12);
        setData((d) => ({ ...d, password: pwd, password_confirmation: pwd }));
    };

    return (
        <AppLayout title="Nuevo usuario">
            <Head title="Nuevo usuario" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo usuario"
                    breadcrumbs={[{ label: 'Usuarios', href: route('users.index') }, { label: 'Nuevo' }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('users.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Crear usuario</Button>
                        </div>
                    }
                />

                <MembershipLimitAlert />

                <Card>
                    <CardHeader title="Datos del usuario" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input label="Apellido" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} error={errors.last_name} />
                        <Input type="email" label="Correo electronico" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} required />
                        <Input label="Telefono" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
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
                                placeholder="Selecciona una empresa"
                                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                            />
                        )}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Contrasena"
                        action={
                            <Button type="button" variant="ghost" size="sm" icon={<ArrowPathIcon className="h-4 w-4" />} onClick={generate}>
                                Generar
                            </Button>
                        }
                    />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input type="text" label="Contrasena" value={data.password} onChange={(e) => setData('password', e.target.value)} error={errors.password} required />
                        <Input type="text" label="Confirmar contrasena" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required />
                    </div>
                </Card>

                <Card>
                    <CardHeader title="Estado" />
                    <div className="mt-4">
                        <Switch
                            checked={data.is_active}
                            onChange={(v) => setData('is_active', v)}
                            label="Usuario activo"
                            description="Si esta inactivo, el usuario no podra iniciar sesion."
                        />
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
