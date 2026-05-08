import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Textarea } from '@/Components/UI/Textarea';
import { PermissionMatrix } from '@/Components/Permissions/PermissionMatrix';
import { PermissionPresets } from '@/Components/Permissions/PermissionPresets';
import AppLayout from '@/Layouts/AppLayout';
import { slugify } from '@/lib/utils';
import type { PermissionMatrix as MatrixType } from '@/types';

interface RoleData {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    color: string;
    is_system: boolean;
    permissions: string[];
}

interface Props {
    role: RoleData;
    matrix: MatrixType;
}

const colorPresets = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function RoleEdit({ role, matrix }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        display_name: role.display_name,
        name: role.name,
        description: role.description ?? '',
        color: role.color,
        permissions: role.permissions ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('roles.update', role.id));
    };

    return (
        <AppLayout title={`Editar ${role.display_name}`}>
            <Head title={`Editar ${role.display_name}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${role.display_name}`}
                    breadcrumbs={[{ label: 'Roles', href: route('roles.index') }, { label: role.display_name }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('roles.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Guardar cambios</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos del rol" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre del rol" value={data.display_name} onChange={(e) => setData('display_name', e.target.value)} error={errors.display_name} required />
                        <Input label="Identificador interno" value={data.name} onChange={(e) => setData('name', slugify(e.target.value))} error={errors.name} required />
                        <Textarea label="Descripcion" value={data.description} onChange={(e) => setData('description', e.target.value)} className="sm:col-span-2" rows={2} />
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
                            <div className="flex flex-wrap items-center gap-2">
                                {colorPresets.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setData('color', color)}
                                        className={`h-8 w-8 rounded-full border-2 ${data.color === color ? 'border-slate-900 scale-110 dark:border-white' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <input type="color" value={data.color} onChange={(e) => setData('color', e.target.value)} className="h-8 w-8 cursor-pointer rounded-full border border-slate-300 dark:border-slate-600" />
                            </div>
                        </div>
                    </div>
                </Card>

                <PermissionPresets matrix={matrix} onApply={(perms) => setData('permissions', perms)} />

                <PermissionMatrix
                    matrix={matrix}
                    value={data.permissions}
                    onChange={(perms) => setData('permissions', perms)}
                />

                {errors.permissions && <p className="text-sm text-rose-500">{errors.permissions}</p>}
            </form>
        </AppLayout>
    );
}
