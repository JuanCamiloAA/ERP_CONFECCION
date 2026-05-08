import { Head, router, useForm, usePage } from '@inertiajs/react';
import { BuildingOffice2Icon, CheckIcon, MinusCircleIcon, PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { Company } from '@/types';

interface Deduction {
    key: string;
    label: string;
    percent: number;
}

interface SettingsData {
    currency: string;
    payroll_periodicity: string;
    default_deductions: Deduction[];
}

interface SettingsFormData {
    name: string;
    nit: string;
    address: string;
    phone: string;
    email: string;
    logo: File | null;
    settings: SettingsData;
}

interface Props {
    company: Company | null;
    settings: SettingsData;
}

export default function SettingsIndex({ company, settings }: Props) {
    const { can } = usePermissions();
    const canEdit = can('settings.index.edit');
    const page = usePage<App.PageProps>();
    const payrollPeriodicities = page.props.payrollPeriodicities ?? [];
    const periodicityOptions = useMemo(
        () => payrollPeriodicities.map((p) => ({ value: p.code, label: p.name })),
        [payrollPeriodicities],
    );
    const [preview, setPreview] = useState<string | null>(company?.logo ? `/storage/${company.logo}` : null);

    const { data, setData, processing, errors } = useForm<SettingsFormData>({
        name: company?.name ?? '',
        nit: company?.nit ?? '',
        address: company?.address ?? '',
        phone: company?.phone ?? '',
        email: company?.email ?? '',
        logo: null as File | null,
        settings: {
            currency: settings.currency ?? 'COP',
            payroll_periodicity: settings.payroll_periodicity ?? 'quincenal',
            default_deductions: settings.default_deductions ?? [],
        },
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        router.post(route('settings.update'), { ...data, _method: 'put' } as never, { forceFormData: true });
    };

    const updateSettings = (next: Partial<SettingsData>) => {
        setData('settings', { ...data.settings, ...next });
    };

    const updateDeduction = (index: number, patch: Partial<Deduction>) => {
        const arr = [...data.settings.default_deductions];
        arr[index] = { ...arr[index], ...patch };
        updateSettings({ default_deductions: arr });
    };

    const addDeduction = () => {
        updateSettings({
            default_deductions: [
                ...data.settings.default_deductions,
                { key: '', label: '', percent: 0 },
            ],
        });
    };

    const removeDeduction = (index: number) => {
        updateSettings({
            default_deductions: data.settings.default_deductions.filter((_, i) => i !== index),
        });
    };

    const onLogoChange = (file: File | null) => {
        setData('logo', file);
        if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : company?.logo ? `/storage/${company.logo}` : null);
    };

    return (
        <AppLayout title="Mi empresa">
            <Head title="Mi empresa" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Mi empresa"
                    description="Datos, logo y parametros de nomina solo de su empresa. No puede ver ni editar otras empresas."
                    action={
                        canEdit ? (
                            <Button type="submit" loading={processing} icon={<CheckIcon className="h-4 w-4" />}>
                                Guardar cambios
                            </Button>
                        ) : undefined
                    }
                />

                {!canEdit && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                        Solo tiene permiso de lectura en esta seccion.
                    </div>
                )}

                {page.props.flash?.success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {page.props.flash.success}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader title="Datos de la empresa" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={errors.name}
                                required
                                disabled={!canEdit}
                            />
                            <Input
                                label="NIT"
                                value={data.nit}
                                onChange={(e) => setData('nit', e.target.value)}
                                error={errors.nit}
                                disabled={!canEdit}
                            />
                            <Input
                                type="email"
                                label="Correo"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={errors.email}
                                disabled={!canEdit}
                            />
                            <Input
                                label="Telefono"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={errors.phone}
                                disabled={!canEdit}
                            />
                            <Textarea
                                label="Direccion"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                className="sm:col-span-2"
                                rows={2}
                                disabled={!canEdit}
                            />
                        </div>
                    </Card>

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
                            <label className={canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={!canEdit}
                                    onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                                />
                                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                    <PhotoIcon className="h-4 w-4" /> Cambiar logo
                                </span>
                            </label>
                        </div>
                    </Card>
                </div>

                <Card>
                    <CardHeader title="Nomina" description="Configura la moneda y la periodicidad de la nomina." />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Moneda"
                            value={data.settings.currency}
                            onChange={(e) => updateSettings({ currency: e.target.value })}
                            options={[
                                { value: 'COP', label: 'COP - Peso colombiano' },
                                { value: 'USD', label: 'USD - Dolar' },
                                { value: 'MXN', label: 'MXN - Peso mexicano' },
                                { value: 'EUR', label: 'EUR - Euro' },
                            ]}
                            disabled={!canEdit}
                        />
                        <Select
                            label="Periodicidad por defecto"
                            value={data.settings.payroll_periodicity}
                            onChange={(e) => updateSettings({ payroll_periodicity: e.target.value })}
                            options={periodicityOptions}
                            disabled={!canEdit}
                        />
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Deducciones por defecto"
                        description="Se aplicaran al calcular nuevas nominas."
                        action={
                            canEdit ? (
                                <Button type="button" variant="outline" size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={addDeduction}>
                                    Agregar deduccion
                                </Button>
                            ) : undefined
                        }
                    />
                    <div className="mt-4 space-y-3">
                        {data.settings.default_deductions.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">No hay deducciones configuradas.</p>
                        ) : (
                            data.settings.default_deductions.map((deduction, index) => (
                                <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-[1fr,1fr,140px,auto]">
                                    <Input
                                        label={index === 0 ? 'Identificador' : undefined}
                                        value={deduction.key}
                                        onChange={(e) => updateDeduction(index, { key: e.target.value })}
                                        placeholder="ej. salud"
                                        disabled={!canEdit}
                                    />
                                    <Input
                                        label={index === 0 ? 'Etiqueta' : undefined}
                                        value={deduction.label}
                                        onChange={(e) => updateDeduction(index, { label: e.target.value })}
                                        placeholder="ej. Salud"
                                        disabled={!canEdit}
                                    />
                                    <Input
                                        type="number"
                                        step="0.01"
                                        label={index === 0 ? '%' : undefined}
                                        value={String(deduction.percent ?? 0)}
                                        onChange={(e) => updateDeduction(index, { percent: parseFloat(e.target.value) || 0 })}
                                        disabled={!canEdit}
                                    />
                                    <div className="flex items-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            icon={<MinusCircleIcon className="h-4 w-4 text-rose-500" />}
                                            onClick={() => removeDeduction(index)}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
