import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { BuildingOffice2Icon, MinusCircleIcon, PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { FilterChips } from '@/Components/UI/FilterChips';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { SideIndex } from '@/Components/UI/SideIndex';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { Textarea } from '@/Components/UI/Textarea';
import { DifficultyScale } from '@/Components/Settings/DifficultyScale';
import { SettingsSection } from '@/Components/Settings/SettingsSection';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, DIFFICULTY_LABELS } from '@/lib/difficulty';
import { mediaUrl } from '@/lib/mediaUrl';
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
    difficulty_minute_thresholds: number[];
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

const CURRENCIES = [
    { value: 'COP', label: 'COP - Peso colombiano' },
    { value: 'USD', label: 'USD - Dolar' },
    { value: 'MXN', label: 'MXN - Peso mexicano' },
    { value: 'EUR', label: 'EUR - Euro' },
];

const percentFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SettingsIndex({ company, settings }: Props) {
    const { can } = usePermissions();
    const canEdit = can('settings.index.edit');
    const page = usePage<App.PageProps>();
    const payrollPeriodicities = page.props.payrollPeriodicities ?? [];

    const initial: SettingsFormData = useMemo(
        () => ({
            name: company?.name ?? '',
            nit: company?.nit ?? '',
            address: company?.address ?? '',
            phone: company?.phone ?? '',
            email: company?.email ?? '',
            logo: null,
            settings: {
                currency: settings.currency ?? 'COP',
                payroll_periodicity: settings.payroll_periodicity ?? 'quincenal',
                default_deductions: settings.default_deductions ?? [],
                difficulty_minute_thresholds:
                    settings.difficulty_minute_thresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS,
            },
        }),
        [company, settings],
    );

    // `useForm().put/post` y no `router.post` suelto: con el segundo, `errors` y `processing`
    // de este formulario nunca se rellenaban y los fallos de validacion no se veian.
    const { data, setData, post, transform, processing, errors, reset } = useForm<SettingsFormData>(initial);

    const [preview, setPreview] = useState<string | null>(company?.logo ? (mediaUrl(company.logo) ?? null) : null);

    const fieldErrors = errors as Record<string, string>;

    const deductionsTotal = useMemo(
        () => data.settings.default_deductions.reduce((sum, row) => sum + (Number(row.percent) || 0), 0),
        [data.settings.default_deductions],
    );

    const changes = useMemo(() => {
        let count = 0;

        (['name', 'nit', 'address', 'phone', 'email'] as const).forEach((key) => {
            if (data[key] !== initial[key]) count++;
        });
        if (data.logo !== null) count++;
        if (data.settings.currency !== initial.settings.currency) count++;
        if (data.settings.payroll_periodicity !== initial.settings.payroll_periodicity) count++;
        if (
            JSON.stringify(data.settings.default_deductions) !== JSON.stringify(initial.settings.default_deductions)
        ) {
            count++;
        }
        if (
            JSON.stringify(data.settings.difficulty_minute_thresholds) !==
            JSON.stringify(initial.settings.difficulty_minute_thresholds)
        ) {
            count++;
        }

        return count;
    }, [data, initial]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (! canEdit) return;

        // PUT con adjunto: el navegador no envia multipart en PUT, de ahi el `_method`.
        transform((payload) => ({ ...payload, _method: 'put' }));
        post(route('settings.update'), { forceFormData: true, preserveScroll: true });
    };

    const updateSettings = (next: Partial<SettingsData>) => {
        setData('settings', { ...data.settings, ...next });
    };

    const updateThreshold = (index: number, value: number) => {
        const arr = [...data.settings.difficulty_minute_thresholds];
        arr[index] = value;
        updateSettings({ difficulty_minute_thresholds: arr });
    };

    const updateDeduction = (index: number, patch: Partial<Deduction>) => {
        const arr = [...data.settings.default_deductions];
        arr[index] = { ...arr[index], ...patch };
        updateSettings({ default_deductions: arr });
    };

    const addDeduction = () => {
        updateSettings({
            default_deductions: [...data.settings.default_deductions, { key: '', label: '', percent: 0 }],
        });
    };

    const removeDeduction = (index: number) => {
        updateSettings({
            default_deductions: data.settings.default_deductions.filter((_, i) => i !== index),
        });
    };

    const onLogoChange = (file: File | null) => {
        setData('logo', file);
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : company?.logo ? (mediaUrl(company.logo) ?? null) : null);
    };

    const discard = () => {
        reset();
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(company?.logo ? (mediaUrl(company.logo) ?? null) : null);
    };

    const periodicityName =
        payrollPeriodicities.find((p) => p.code === data.settings.payroll_periodicity)?.name ?? 'Sin definir';

    const indexItems = [
        { id: 'datos', label: 'Datos', meta: data.name || 'Sin nombre' },
        { id: 'nomina', label: 'Nómina', meta: `${data.settings.currency} · ${periodicityName}` },
        {
            id: 'deducciones',
            label: 'Deducciones',
            meta: `${data.settings.default_deductions.length} · ${percentFormat.format(deductionsTotal)} %`,
        },
        {
            id: 'dificultad',
            label: 'Dificultad',
            meta: `hasta ${data.settings.difficulty_minute_thresholds[3] ?? 0} min`,
        },
    ];

    return (
        <AppLayout title="Mi empresa">
            <Head title="Mi empresa" />

            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Mi empresa"
                    description="Datos, logo y parametros de nomina solo de su empresa. No puede ver ni editar otras empresas."
                />

                {! canEdit && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                        Solo tiene permiso de lectura en esta seccion.
                    </div>
                )}

                {page.props.flash?.success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {page.props.flash.success}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[196px,1fr]">
                    <SideIndex items={indexItems} />

                    <div className="min-w-0 space-y-6">
                        <SettingsSection id="datos" title="Datos" description="Identificación y contacto de la empresa.">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="Nombre"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    error={errors.name}
                                    required
                                    disabled={! canEdit}
                                />
                                <Input
                                    label="NIT"
                                    value={data.nit}
                                    onChange={(e) => setData('nit', e.target.value)}
                                    error={errors.nit}
                                    disabled={! canEdit}
                                />
                                <Input
                                    type="email"
                                    label="Correo"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    error={errors.email}
                                    disabled={! canEdit}
                                />
                                <Input
                                    label="Telefono"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    error={errors.phone}
                                    disabled={! canEdit}
                                />
                                <Textarea
                                    label="Direccion"
                                    value={data.address}
                                    onChange={(e) => setData('address', e.target.value)}
                                    error={errors.address}
                                    className="sm:col-span-2"
                                    rows={2}
                                    disabled={! canEdit}
                                />
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-700">
                                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                                    {preview ? (
                                        <ZoomableImage
                                            src={preview}
                                            alt="logo"
                                            title="Logo de la empresa"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <BuildingOffice2Icon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Logo</p>
                                    <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                                        Se usa en recibos y documentos. Máximo 2 MB.
                                    </p>
                                    <label className={canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="sr-only"
                                            disabled={! canEdit}
                                            onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                                        />
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                            <PhotoIcon className="h-4 w-4" /> Cambiar logo
                                        </span>
                                    </label>
                                    {errors.logo && <p className="mt-1 text-xs text-rose-500">{errors.logo}</p>}
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            id="nomina"
                            title="Nómina"
                            description="Moneda y periodicidad con la que se crean las nóminas nuevas."
                        >
                            <div className="max-w-xs">
                                <Select
                                    label="Moneda"
                                    value={data.settings.currency}
                                    onChange={(e) => updateSettings({ currency: e.target.value })}
                                    options={CURRENCIES}
                                    disabled={! canEdit}
                                />
                            </div>

                            <div className="mt-5">
                                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Periodicidad por defecto
                                </p>

                                {payrollPeriodicities.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        No hay periodicidades activas.
                                    </p>
                                ) : (
                                    <FilterChips
                                        chips={payrollPeriodicities.map((p) => ({ key: p.code, label: p.name }))}
                                        active={data.settings.payroll_periodicity}
                                        onChange={(key) => updateSettings({ payroll_periodicity: key })}
                                        label="Periodicidad por defecto"
                                        disabled={! canEdit}
                                    />
                                )}

                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Se administran en{' '}
                                    <Link
                                        href={route('payroll-periodicities.index')}
                                        className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                    >
                                        Periodicidad de pagos
                                    </Link>
                                    .
                                </p>

                                {fieldErrors['settings.payroll_periodicity'] && (
                                    <p className="mt-1 text-xs text-rose-500">
                                        {fieldErrors['settings.payroll_periodicity']}
                                    </p>
                                )}
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            id="deducciones"
                            title="Deducciones"
                            description="Se aplican al calcular nóminas nuevas."
                            aside={
                                <span
                                    className={
                                        deductionsTotal > 100
                                            ? 'text-sm font-medium tabular-nums text-rose-600 dark:text-rose-400'
                                            : 'text-sm tabular-nums text-slate-500 dark:text-slate-400'
                                    }
                                >
                                    Suman {percentFormat.format(deductionsTotal)} % del devengado
                                </span>
                            }
                        >
                            {data.settings.default_deductions.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    No hay deducciones configuradas.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[32rem] text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                <th scope="col" className="py-2 pr-3 font-medium">
                                                    Identificador
                                                </th>
                                                <th scope="col" className="py-2 pr-3 font-medium">
                                                    Etiqueta
                                                </th>
                                                <th scope="col" className="py-2 pr-3 text-right font-medium">
                                                    %
                                                </th>
                                                <th scope="col" className="w-10 py-2">
                                                    <span className="sr-only">Quitar</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {data.settings.default_deductions.map((deduction, index) => (
                                                <tr key={index}>
                                                    <td className="py-2 pr-3">
                                                        <Input
                                                            value={deduction.key}
                                                            onChange={(e) => updateDeduction(index, { key: e.target.value })}
                                                            placeholder="ej. salud"
                                                            aria-label={`Identificador de la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                        />
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <Input
                                                            value={deduction.label}
                                                            onChange={(e) => updateDeduction(index, { label: e.target.value })}
                                                            placeholder="ej. Salud"
                                                            aria-label={`Etiqueta de la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                        />
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <div className="ml-auto w-28">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min={0}
                                                                max={100}
                                                                value={String(deduction.percent ?? 0)}
                                                                onChange={(e) =>
                                                                    updateDeduction(index, {
                                                                        percent: parseFloat(e.target.value) || 0,
                                                                    })
                                                                }
                                                                aria-label={`Porcentaje de la deducción ${index + 1}`}
                                                                className="text-right tabular-nums"
                                                                disabled={! canEdit}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<MinusCircleIcon className="h-4 w-4 text-rose-500" />}
                                                            onClick={() => removeDeduction(index)}
                                                            aria-label={`Quitar la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-slate-200 dark:border-slate-700">
                                                <td colSpan={2} className="py-2 pr-3 text-slate-500 dark:text-slate-400">
                                                    Total
                                                </td>
                                                <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                    {percentFormat.format(deductionsTotal)} %
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {deductionsTotal > 100 && (
                                <p className="mt-3 text-xs text-rose-500">
                                    Las deducciones no pueden pasar del 100 % del devengado.
                                </p>
                            )}
                            {fieldErrors['settings.default_deductions'] && (
                                <p className="mt-1 text-xs text-rose-500">{fieldErrors['settings.default_deductions']}</p>
                            )}

                            {canEdit && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    icon={<PlusIcon className="h-4 w-4" />}
                                    onClick={addDeduction}
                                    className="mt-4"
                                >
                                    Agregar deduccion
                                </Button>
                            )}
                        </SettingsSection>

                        <SettingsSection
                            id="dificultad"
                            title="Dificultad"
                            description="Hasta dónde llega cada grado, en minutos. El grado de cada operación se calcula solo con estos rangos."
                        >
                            <DifficultyScale thresholds={data.settings.difficulty_minute_thresholds} />

                            <div className="mt-5 space-y-2">
                                {data.settings.difficulty_minute_thresholds.map((value, index) => {
                                    const from = index === 0 ? 0 : data.settings.difficulty_minute_thresholds[index - 1];

                                    return (
                                        <div key={index} className="flex flex-wrap items-center gap-3">
                                            <Badge variant="info" className="w-28 shrink-0 justify-center">
                                                {index + 1} - {DIFFICULTY_LABELS[index + 1]}
                                            </Badge>
                                            <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                                de {from} a {value} min
                                            </span>
                                            <div className="ml-auto w-36">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0.01}
                                                    value={String(value)}
                                                    onChange={(e) => updateThreshold(index, parseFloat(e.target.value) || 0)}
                                                    suffix="min"
                                                    aria-label={`Tope del grado ${index + 1}`}
                                                    className="text-right tabular-nums"
                                                    disabled={! canEdit}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="flex flex-wrap items-center gap-3">
                                    <Badge variant="warning" className="w-28 shrink-0 justify-center">
                                        5 - {DIFFICULTY_LABELS[5]}
                                    </Badge>
                                    <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                                        más de {data.settings.difficulty_minute_thresholds[3]} min
                                    </span>
                                </div>
                            </div>

                            {fieldErrors['settings.difficulty_minute_thresholds'] && (
                                <p className="mt-3 text-xs text-rose-500">
                                    {fieldErrors['settings.difficulty_minute_thresholds']}
                                </p>
                            )}

                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                Al guardar, ninguna referencia se recalcula: usa <strong>Reaplicar rangos</strong> en
                                Referencias.
                            </p>
                        </SettingsSection>
                    </div>
                </div>

                {canEdit && (
                    <StickySaveBar changes={changes} processing={processing} onCancel={discard} />
                )}
            </form>
        </AppLayout>
    );
}
