import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, KeyIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { FormEvent, useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { RoleBadge } from '@/Components/Roles/RoleBadge';
import AppLayout from '@/Layouts/AppLayout';
import type { AuthUser } from '@/types';

interface Props {
    user: AuthUser & { roles: { id: number; name: string; display_name: string; color: string }[] };
}

export default function ProfileEdit({ user }: Props) {
    const page = usePage<App.PageProps>();
    const [preview, setPreview] = useState<string | null>(user.avatar ? `/storage/${user.avatar}` : null);

    const { data, setData, processing, errors } = useForm({
        name: user.name,
        last_name: user.last_name ?? '',
        email: user.email,
        phone: user.phone ?? '',
        avatar: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.post(route('profile.update'), { ...data, _method: 'put' } as never, { forceFormData: true });
    };

    const onAvatarChange = (file: File | null) => {
        setData('avatar', file);
        if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : null);
    };

    const role = user.roles?.[0];

    return (
        <AppLayout title="Mi perfil">
            <Head title="Mi perfil" />
            <div className="space-y-6">
                <PageHeader
                    title="Mi perfil"
                    description="Actualiza tu informacion personal y tus credenciales."
                    action={
                        <Link href={route('profile.change-password.show')}>
                            <Button variant="outline" icon={<KeyIcon className="h-4 w-4" />}>
                                Cambiar contrasena
                            </Button>
                        </Link>
                    }
                />

                {page.props.flash?.success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {page.props.flash.success}
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card>
                            <CardHeader title="Foto de perfil" />
                            <div className="mt-4 flex flex-col items-center gap-3">
                                {preview ? (
                                    <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-slate-200 dark:border-slate-700">
                                        <img src={preview} alt={user.full_name} className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <Avatar src={null} name={user.full_name} size="xl" />
                                )}

                                <p className="text-center text-sm font-medium text-slate-900 dark:text-slate-100">{user.full_name}</p>
                                {role && <RoleBadge role={role} />}

                                <label className="cursor-pointer">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatarChange(e.target.files?.[0] ?? null)} />
                                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                        <PhotoIcon className="h-4 w-4" /> Cambiar foto
                                    </span>
                                </label>
                                {errors.avatar && <p className="text-xs text-rose-500">{errors.avatar}</p>}
                            </div>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader
                                title="Informacion personal"
                                action={<Button type="submit" loading={processing}>Guardar cambios</Button>}
                            />
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                                <Input label="Apellido" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} error={errors.last_name} />
                                <Input type="email" label="Correo electronico" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} required />
                                <Input label="Telefono" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
                            </div>
                        </Card>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
