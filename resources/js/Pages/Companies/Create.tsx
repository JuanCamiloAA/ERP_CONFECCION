import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, BuildingOffice2Icon, PhotoIcon } from '@heroicons/react/24/outline';
import { FormEvent, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';

export default function CompanyCreate() {
    const [preview, setPreview] = useState<string | null>(null);

    const { data, setData, processing, errors } = useForm({
        name: '',
        nit: '',
        address: '',
        phone: '',
        email: '',
        logo: null as File | null,
        is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.post(route('companies.store'), data as never, { forceFormData: true });
    };

    const onLogoChange = (file: File | null) => {
        setData('logo', file);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : null);
    };

    return (
        <AppLayout title="Nueva empresa">
            <Head title="Nueva empresa" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva empresa"
                    breadcrumbs={[{ label: 'Empresas', href: route('companies.index') }, { label: 'Nueva' }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('companies.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Crear empresa</Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader title="Datos de la empresa" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                            <Input label="NIT" value={data.nit} onChange={(e) => setData('nit', e.target.value)} error={errors.nit} />
                            <Input type="email" label="Correo de contacto" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                            <Input label="Telefono" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
                            <Textarea label="Direccion" value={data.address} onChange={(e) => setData('address', e.target.value)} error={errors.address} className="sm:col-span-2" rows={2} />
                        </div>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader title="Logo" />
                            <div className="mt-4 flex flex-col items-center gap-3">
                                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                                    {preview ? (
                                        <img src={preview} alt="logo" className="h-full w-full object-cover" />
                                    ) : (
                                        <BuildingOffice2Icon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                                    )}
                                </div>
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                                    />
                                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                        <PhotoIcon className="h-4 w-4" /> Subir logo
                                    </span>
                                </label>
                                {errors.logo && <p className="text-xs text-rose-500">{errors.logo}</p>}
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Estado" />
                            <div className="mt-4">
                                <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Empresa activa" />
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
