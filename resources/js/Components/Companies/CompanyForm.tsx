import { Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, BuildingOffice2Icon, PhotoIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { UsageBar } from '@/Components/UI/UsageBar';
import { PlanRadioList, type PlanOption } from '@/Components/Companies/PlanRadioList';
import { mediaUrl } from '@/lib/mediaUrl';

export interface CompanyFormCompany {
    id: number;
    name: string;
    nit: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
    is_active: boolean;
    membership_plan_id: number | null;
    membership_started_at: string | null;
    membership_ends_at: string | null;
    staff_users_count?: number;
    employees_count?: number;
    membership_plan?: { max_staff_users: number | null; max_employees: number | null } | null;
}

interface Props {
    plans: PlanOption[];
    /** Ausente al crear. */
    company?: CompanyFormCompany;
}

type FormFields = {
    name: string;
    nit: string;
    address: string;
    phone: string;
    email: string;
    logo: File | null;
    is_active: boolean;
    membership_plan_id: string;
    membership_started_at: string;
    membership_ends_at: string;
};

/**
 * Formulario unico de crear y editar empresa.
 *
 * Antes eran dos archivos casi identicos que ya habian empezado a divergir (el aviso de uso
 * del plan solo existia en editar). Uno solo obliga a que cualquier campo nuevo aparezca en
 * los dos sitios.
 */
export function CompanyForm({ plans, company }: Props) {
    const editing = company !== undefined;

    const initial: FormFields = useMemo(
        () => ({
            name: company?.name ?? '',
            nit: company?.nit ?? '',
            address: company?.address ?? '',
            phone: company?.phone ?? '',
            email: company?.email ?? '',
            logo: null,
            is_active: company?.is_active ?? true,
            membership_plan_id: company?.membership_plan_id != null ? String(company.membership_plan_id) : '',
            membership_started_at: company?.membership_started_at?.slice(0, 10) ?? '',
            membership_ends_at: company?.membership_ends_at?.slice(0, 10) ?? '',
        }),
        [company],
    );

    // `useForm` y no `router.post` suelto: solo asi se rellenan `errors` y `processing`.
    // Con `router.post` los errores de validacion del servidor no llegaban nunca al formulario.
    const { data, setData, post, transform, processing, errors, reset } = useForm<FormFields>(initial);

    const [preview, setPreview] = useState<string | null>(
        company?.logo ? (mediaUrl(company.logo) ?? null) : null,
    );

    const changes = useMemo(
        () =>
            (Object.keys(initial) as (keyof FormFields)[]).filter((key) =>
                key === 'logo' ? data.logo !== null : data[key] !== initial[key],
            ).length,
        [data, initial],
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (editing) {
            // PUT con adjunto: el navegador no envia multipart en PUT, de ahi el `_method`.
            transform((payload) => ({ ...payload, _method: 'put' }));
            post(route('companies.update', company.id), { forceFormData: true, preserveScroll: true });

            return;
        }

        post(route('companies.store'), { forceFormData: true });
    };

    const onLogoChange = (file: File | null) => {
        setData('logo', file);
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : (company?.logo ? (mediaUrl(company.logo) ?? null) : null));
    };

    const discard = () => {
        reset();
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(company?.logo ? (mediaUrl(company.logo) ?? null) : null);
    };

    const selectedPlan = plans.find((plan) => String(plan.id) === data.membership_plan_id) ?? null;

    return (
        <form onSubmit={submit} className="space-y-6">
            <PageHeader
                title={editing ? `Editar ${company.name}` : 'Nueva empresa'}
                breadcrumbs={[
                    { label: 'Empresas', href: route('companies.index') },
                    { label: editing ? company.name : 'Nueva' },
                ]}
                action={
                    <Link href={route('companies.index')} className="shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            icon={<ArrowLeftIcon className="h-4 w-4" />}
                            className="whitespace-nowrap shrink-0"
                        >
                            Volver al listado
                        </Button>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader title="Datos de la empresa" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={errors.name}
                                required
                            />
                            <Input
                                label="NIT"
                                value={data.nit}
                                onChange={(e) => setData('nit', e.target.value)}
                                error={errors.nit}
                            />
                            <Input
                                type="email"
                                label="Correo de contacto"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={errors.email}
                            />
                            <Input
                                label="Telefono"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                            />
                            <Textarea
                                label="Direccion"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                error={errors.address}
                                className="sm:col-span-2"
                                rows={2}
                            />
                        </div>
                    </Card>

                    {editing ? (
                        <Card>
                            <CardHeader
                                title="Uso del plan"
                                description={
                                    selectedPlan
                                        ? `Límites del plan ${selectedPlan.name}.`
                                        : 'Sin plan asignado: no hay límites que controlar.'
                                }
                            />
                            <div className="mt-4 space-y-4">
                                <UsageBar
                                    used={company.staff_users_count ?? 0}
                                    limit={selectedPlan?.max_staff_users ?? null}
                                    label="Usuarios staff"
                                />
                                <UsageBar
                                    used={company.employees_count ?? 0}
                                    limit={selectedPlan?.max_employees ?? null}
                                    label="Empleados"
                                />
                                <Link
                                    href={route('users.index', { company_id: company.id })}
                                    className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                >
                                    Ver los {company.staff_users_count ?? 0} usuarios de esta empresa
                                </Link>
                            </div>
                        </Card>
                    ) : null}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader title="Membresía" />
                        <div className="mt-4 space-y-4">
                            <PlanRadioList
                                plans={plans}
                                value={data.membership_plan_id}
                                onChange={(value) => setData('membership_plan_id', value)}
                                emptyLabel={editing ? 'Sin plan' : 'Predeterminado (primer plan activo)'}
                                error={errors.membership_plan_id}
                            />
                            <Input
                                type="date"
                                label={editing ? 'Inicio membresía' : 'Inicio membresía (opcional)'}
                                value={data.membership_started_at}
                                onChange={(e) => setData('membership_started_at', e.target.value)}
                                error={errors.membership_started_at}
                            />
                            <Input
                                type="date"
                                label={editing ? 'Fin membresía' : 'Fin membresía (opcional)'}
                                value={data.membership_ends_at}
                                onChange={(e) => setData('membership_ends_at', e.target.value)}
                                error={errors.membership_ends_at}
                            />
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="Logo" />
                        <div className="mt-4 flex flex-col items-center gap-3">
                            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                                {preview ? (
                                    <ZoomableImage
                                        src={preview}
                                        alt="logo"
                                        title="Logo de la empresa"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <BuildingOffice2Icon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                                />
                                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                    <PhotoIcon className="h-4 w-4" /> {editing ? 'Cambiar logo' : 'Subir logo'}
                                </span>
                            </label>
                            {errors.logo && <p className="text-xs text-rose-500">{errors.logo}</p>}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader title="Estado" />
                        <div className="mt-4">
                            <Switch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Empresa activa"
                                description="Al desactivarla, sus empleados y usuarios pierden el acceso."
                            />
                        </div>
                    </Card>
                </div>
            </div>

            <StickySaveBar
                changes={changes}
                processing={processing}
                onCancel={discard}
                submitLabel={editing ? 'Guardar cambios' : 'Crear empresa'}
            />
        </form>
    );
}

export default CompanyForm;
