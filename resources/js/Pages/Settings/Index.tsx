import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Buildings, Image as ImageIcon, MinusCircle, Plus } from '@phosphor-icons/react';
import { type FormEvent, useMemo, useState } from 'react';
import { DifficultyScale } from '@/Components/Settings/DifficultyScale';
import { MembershipSection } from '@/Components/Settings/MembershipSection';
import { SettingsSection } from '@/Components/Settings/SettingsSection';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import { SideIndex } from '@/Components/UI/SideIndex';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { usePermissions } from '@/contexts/PermissionsContext';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, DIFFICULTY_LABELS } from '@/lib/difficulty';
import { mediaUrl } from '@/lib/mediaUrl';
import type { Company, Membership } from '@/types';
import '../../../css/module-ui.css';

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
    membership: Membership;
}

const CURRENCIES = [
    { value: 'COP', label: 'COP - Peso colombiano' },
    { value: 'USD', label: 'USD - Dolar' },
    { value: 'MXN', label: 'MXN - Peso mexicano' },
    { value: 'EUR', label: 'EUR - Euro' },
];

const percentFormat = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SettingsIndex({ company, settings, membership }: Props) {
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
        { id: 'membresia', label: 'Membresía', meta: membership.plan?.name ?? 'Sin plan' },
    ];

    return (
        <AppLayout title="Mi empresa">
            <Head title="Mi empresa" />

            <form onSubmit={submit} className="emp-form emp-bleed min-h-screen px-4 pb-8 pt-5 sm:px-[34px]">
                {/* -------------------------------------------------- cabecera */}
                <div className="min-w-0">
                    <h1 className="text-[24px]" style={{ color: 'var(--emp-text)' }}>
                        Mi empresa
                    </h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                        Datos, logo y parámetros de nómina solo de su empresa. No puede ver ni editar otras empresas.
                    </p>
                </div>

                {! canEdit && <p className="emp-note mt-4">Solo tiene permiso de lectura en esta sección.</p>}

                {page.props.flash?.success && (
                    <p
                        className="mt-4 rounded-lg px-3 py-2 text-[13px]"
                        style={{
                            color: 'var(--emp-ok)',
                            backgroundColor: 'color-mix(in srgb, var(--emp-ok) 12%, transparent)',
                        }}
                    >
                        {page.props.flash.success}
                    </p>
                )}

                <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[196px_1fr]">
                    <SideIndex items={indexItems} />

                    <div className="min-w-0 space-y-5">
                        {/* ------------------------------------------- datos */}
                        <SettingsSection id="datos" title="Datos" description="Identificación y contacto de la empresa.">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Field label="Nombre" required error={fieldErrors.name}>
                                    <input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        disabled={! canEdit}
                                        className="emp-field"
                                    />
                                </Field>
                                <Field label="NIT" error={fieldErrors.nit}>
                                    <input
                                        value={data.nit}
                                        onChange={(e) => setData('nit', e.target.value)}
                                        disabled={! canEdit}
                                        className="emp-field"
                                    />
                                </Field>
                                <Field label="Correo" error={fieldErrors.email}>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        disabled={! canEdit}
                                        className="emp-field"
                                    />
                                </Field>
                                <Field label="Teléfono" error={fieldErrors.phone}>
                                    <input
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        disabled={! canEdit}
                                        className="emp-field"
                                    />
                                </Field>
                                <Field label="Dirección" error={fieldErrors.address} className="sm:col-span-2">
                                    <textarea
                                        value={data.address}
                                        onChange={(e) => setData('address', e.target.value)}
                                        rows={2}
                                        disabled={! canEdit}
                                        className="emp-field h-auto py-2"
                                    />
                                </Field>
                            </div>

                            {/* El logo entra aqui tras un divisor; ya no es una tarjeta aparte. */}
                            <div
                                className="mt-5 flex flex-wrap items-center gap-4 pt-5"
                                style={{ borderTop: '1px solid var(--emp-border)' }}
                            >
                                <div
                                    className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
                                    style={{
                                        border: '2px dashed var(--emp-border)',
                                        backgroundColor: 'var(--emp-field-alt)',
                                    }}
                                >
                                    {preview ? (
                                        <ZoomableImage
                                            src={preview}
                                            alt="logo"
                                            title="Logo de la empresa"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Buildings size={34} style={{ color: 'var(--emp-faint)' }} />
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <p className="text-[13px]" style={{ color: 'var(--emp-text)' }}>
                                        Logo
                                    </p>
                                    <p className="mb-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
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
                                        <span className="emp-btn emp-btn-sm">
                                            <ImageIcon size={14} />
                                            Cambiar logo
                                        </span>
                                    </label>
                                    {fieldErrors.logo && <p className="emp-error">{fieldErrors.logo}</p>}
                                </div>
                            </div>
                        </SettingsSection>

                        {/* ------------------------------------------ nómina */}
                        <SettingsSection
                            id="nomina"
                            title="Nómina"
                            description="Moneda y periodicidad con la que se crean las nóminas nuevas."
                        >
                            <div className="max-w-xs">
                                <Field label="Moneda">
                                    <select
                                        value={data.settings.currency}
                                        onChange={(e) => updateSettings({ currency: e.target.value })}
                                        disabled={! canEdit}
                                        className="emp-field"
                                    >
                                        {CURRENCIES.map((currency) => (
                                            <option key={currency.value} value={currency.value}>
                                                {currency.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>

                            <div className="mt-4">
                                <p className="emp-label">Periodicidad por defecto</p>

                                {payrollPeriodicities.length === 0 ? (
                                    <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                        No hay periodicidades activas.
                                    </p>
                                ) : (
                                    <div className="emp-seg inline-flex flex-wrap">
                                        {payrollPeriodicities.map((periodicity) => (
                                            <button
                                                key={periodicity.code}
                                                type="button"
                                                disabled={! canEdit}
                                                onClick={() => updateSettings({ payroll_periodicity: periodicity.code })}
                                                className={`emp-seg-item ${
                                                    data.settings.payroll_periodicity === periodicity.code
                                                        ? 'emp-seg-on'
                                                        : ''
                                                }`}
                                            >
                                                {periodicity.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <p className="mt-2 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                    Se administran en{' '}
                                    <Link
                                        href={route('payroll-periodicities.index')}
                                        className="underline underline-offset-2"
                                        style={{ color: 'var(--emp-accent-on)' }}
                                    >
                                        Periodicidad de pagos
                                    </Link>
                                    .
                                </p>

                                {fieldErrors['settings.payroll_periodicity'] && (
                                    <p className="emp-error">{fieldErrors['settings.payroll_periodicity']}</p>
                                )}
                            </div>
                        </SettingsSection>

                        {/* -------------------------------------- deducciones */}
                        <SettingsSection
                            id="deducciones"
                            title="Deducciones"
                            description="Se aplican al calcular nóminas nuevas."
                            aside={
                                <span
                                    className="text-[13px] tabular-nums"
                                    style={{
                                        color: deductionsTotal > 100 ? 'var(--emp-danger)' : 'var(--emp-muted)',
                                    }}
                                >
                                    Suman {percentFormat.format(deductionsTotal)} % del devengado
                                </span>
                            }
                        >
                            {data.settings.default_deductions.length === 0 ? (
                                <p className="text-[13px]" style={{ color: 'var(--emp-muted)' }}>
                                    No hay deducciones configuradas.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[32rem] text-left">
                                        <thead>
                                            <tr>
                                                {['Identificador', 'Etiqueta'].map((header) => (
                                                    <th
                                                        key={header}
                                                        scope="col"
                                                        className="px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.09em]"
                                                        style={{
                                                            color: 'var(--emp-subtle)',
                                                            borderBottom: '1px solid var(--emp-border)',
                                                        }}
                                                    >
                                                        {header}
                                                    </th>
                                                ))}
                                                <th
                                                    scope="col"
                                                    className="px-1 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.09em]"
                                                    style={{
                                                        color: 'var(--emp-subtle)',
                                                        borderBottom: '1px solid var(--emp-border)',
                                                    }}
                                                >
                                                    %
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="w-10 pb-2"
                                                    style={{ borderBottom: '1px solid var(--emp-border)' }}
                                                >
                                                    <span className="sr-only">Quitar</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.settings.default_deductions.map((deduction, index) => (
                                                <tr key={index}>
                                                    <td className="px-1 py-2">
                                                        <input
                                                            value={deduction.key}
                                                            onChange={(e) => updateDeduction(index, { key: e.target.value })}
                                                            placeholder="ej. salud"
                                                            aria-label={`Identificador de la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                            className="emp-field"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-2">
                                                        <input
                                                            value={deduction.label}
                                                            onChange={(e) =>
                                                                updateDeduction(index, { label: e.target.value })
                                                            }
                                                            placeholder="ej. Salud"
                                                            aria-label={`Etiqueta de la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                            className="emp-field"
                                                        />
                                                    </td>
                                                    <td className="px-1 py-2">
                                                        <input
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
                                                            disabled={! canEdit}
                                                            className="emp-field ml-auto w-28 text-right tabular-nums"
                                                        />
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDeduction(index)}
                                                            aria-label={`Quitar la deducción ${index + 1}`}
                                                            disabled={! canEdit}
                                                            className="emp-btn emp-btn-sm emp-btn-ghost emp-btn-danger px-2"
                                                        >
                                                            <MinusCircle size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td
                                                    colSpan={2}
                                                    className="px-1 pt-2 text-[13px]"
                                                    style={{
                                                        color: 'var(--emp-muted)',
                                                        borderTop: '1px solid var(--emp-border)',
                                                    }}
                                                >
                                                    Total
                                                </td>
                                                <td
                                                    className="px-1 pt-2 text-right text-[13px] tabular-nums"
                                                    style={{
                                                        color: 'var(--emp-text)',
                                                        borderTop: '1px solid var(--emp-border)',
                                                    }}
                                                >
                                                    {percentFormat.format(deductionsTotal)} %
                                                </td>
                                                <td style={{ borderTop: '1px solid var(--emp-border)' }} />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {deductionsTotal > 100 && (
                                <p className="emp-error">Las deducciones no pueden pasar del 100 % del devengado.</p>
                            )}
                            {fieldErrors['settings.default_deductions'] && (
                                <p className="emp-error">{fieldErrors['settings.default_deductions']}</p>
                            )}

                            {canEdit && (
                                <button type="button" onClick={addDeduction} className="emp-btn emp-btn-sm mt-4">
                                    <Plus size={14} />
                                    Agregar deducción
                                </button>
                            )}
                        </SettingsSection>

                        {/* --------------------------------------- dificultad */}
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
                                            <span className="emp-pill emp-pill-accent w-28 shrink-0 justify-center">
                                                {index + 1} - {DIFFICULTY_LABELS[index + 1]}
                                            </span>
                                            <span
                                                className="text-[13px] tabular-nums"
                                                style={{ color: 'var(--emp-muted)' }}
                                            >
                                                de {from} a {value} min
                                            </span>
                                            <div className="ml-auto w-36">
                                                <div className="emp-compound">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min={0.01}
                                                        value={String(value)}
                                                        onChange={(e) =>
                                                            updateThreshold(index, parseFloat(e.target.value) || 0)
                                                        }
                                                        aria-label={`Tope del grado ${index + 1}`}
                                                        disabled={! canEdit}
                                                        className="text-right tabular-nums"
                                                    />
                                                    {/* `items-center`: el compuesto estira sus
                                                      * hijos, y el sufijo quedaria arriba. */}
                                                    <span
                                                        className="flex shrink-0 items-center pr-2.5 text-[12px]"
                                                        style={{ color: 'var(--emp-subtle)' }}
                                                    >
                                                        min
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* El grado 5 no tiene tope: es «mas de» el ultimo y no se edita. */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="emp-pill w-28 shrink-0 justify-center">
                                        5 - {DIFFICULTY_LABELS[5]}
                                    </span>
                                    <span className="text-[13px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                                        más de {data.settings.difficulty_minute_thresholds[3]} min
                                    </span>
                                </div>
                            </div>

                            {fieldErrors['settings.difficulty_minute_thresholds'] && (
                                <p className="emp-error">{fieldErrors['settings.difficulty_minute_thresholds']}</p>
                            )}

                            <p className="mt-4 text-[12px]" style={{ color: 'var(--emp-muted)' }}>
                                Al guardar, ninguna referencia se recalcula: usa <strong>Reaplicar rangos</strong> en
                                Referencias.
                            </p>
                        </SettingsSection>

                        {/* Va al final y no lleva campos del formulario: se guarda sola. */}
                        <MembershipSection membership={membership} />
                    </div>
                </div>

                {canEdit && <StickySaveBar changes={changes} processing={processing} onCancel={discard} />}
            </form>
        </AppLayout>
    );
}

/* --------------------------------------------------------------- auxiliares */

function Field({
    label,
    children,
    required = false,
    error,
    className = '',
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    error?: string;
    className?: string;
}) {
    return (
        <div className={`min-w-0 ${className}`}>
            <label className="emp-label">
                {label}
                {required ? <span className="emp-req"> *</span> : null}
            </label>
            {children}
            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}
