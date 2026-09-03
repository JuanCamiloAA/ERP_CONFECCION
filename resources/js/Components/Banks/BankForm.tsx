import { Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo, useState } from 'react';
import { BankLogoField } from '@/Components/Banks/BankLogoField';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import type { Bank, BankType } from '@/types';

export interface BankFormBank extends Bank {
    employees_count?: number;
}

interface Props {
    types: { value: BankType; label: string }[];
    /** Ausente al crear. */
    bank?: BankFormBank;
}

type FormFields = {
    name: string;
    code: string;
    type: BankType;
    brand_color: string;
    account_format: string;
    account_hint: string;
    requires_key: boolean;
    notes: string;
    is_active: boolean;
    logo: File | null;
    logo_remove: boolean;
};

/** Código sugerido a partir del nombre: mayúsculas, sin acentos ni signos. */
function suggestCode(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10);
}

/** Monograma que se verá mientras no haya logo. Espeja `Bank::getInitialsAttribute()`. */
function previewInitials(code: string, name: string): string {
    const base = code.trim() !== '' ? code : name;
    const letters = base.replace(/[^\p{L}\p{N}]/gu, '');

    return letters === '' ? '??' : letters.slice(0, 2).toUpperCase();
}

/**
 * Formulario único de crear y editar banco.
 *
 * Las reglas de cuenta viven aquí y no en la ficha del empleado a propósito: se escriben una
 * vez por banco y las lee todo el que capture una cuenta, en vez de repetirse de memoria en
 * cada alta.
 */
export function BankForm({ types, bank }: Props) {
    const editing = bank !== undefined;

    const initial: FormFields = useMemo(
        () => ({
            name: bank?.name ?? '',
            code: bank?.code ?? '',
            type: bank?.type ?? 'bank',
            brand_color: bank?.brand_color ?? '',
            account_format: bank?.account_format ?? '',
            account_hint: bank?.account_hint ?? '',
            requires_key: bank?.requires_key ?? true,
            notes: bank?.notes ?? '',
            is_active: bank?.is_active ?? true,
            logo: null,
            logo_remove: false,
        }),
        [bank],
    );

    const { data, setData, post, transform, processing, errors, reset } = useForm<FormFields>(initial);

    // Mientras no se toque el código a mano, sigue al nombre; después deja de hacerlo para no
    // pisar un código que ya se usa en la carga masiva.
    const [codeTouched, setCodeTouched] = useState(editing && (bank?.code ?? '') !== '');

    const changes = useMemo(
        () =>
            (Object.keys(initial) as (keyof FormFields)[]).filter((key) =>
                key === 'logo' ? data.logo !== null : data[key] !== initial[key],
            ).length,
        [data, initial],
    );

    const fieldErrors = errors as Record<string, string>;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (editing) {
            // PUT con adjunto: el navegador no envía multipart en PUT, de ahí el `_method`.
            transform((payload) => ({ ...payload, _method: 'put' }));
            post(route('banks.update', bank.id), { forceFormData: true, preserveScroll: true });

            return;
        }

        post(route('banks.store'), { forceFormData: true });
    };

    const employeesCount = bank?.employees_count ?? 0;

    return (
        <form onSubmit={submit} className="space-y-6">
            <PageHeader
                title={editing ? `Editar ${bank.name}` : 'Nuevo banco'}
                breadcrumbs={[
                    { label: 'Bancos', href: route('banks.index') },
                    { label: editing ? bank.name : 'Nuevo' },
                ]}
                action={
                    <Link href={route('banks.index')} className="shrink-0">
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
                <div className="min-w-0 space-y-6">
                    <Card>
                        <CardHeader
                            title="Datos del banco"
                            description="El código se usa en la carga masiva de empleados y en los archivos de dispersión."
                        />

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre"
                                value={data.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    setData((current) => ({
                                        ...current,
                                        name,
                                        code: codeTouched ? current.code : suggestCode(name),
                                    }));
                                }}
                                error={errors.name}
                                required
                            />

                            <Input
                                label="Codigo"
                                value={data.code}
                                onChange={(e) => {
                                    setCodeTouched(true);
                                    setData('code', e.target.value.toUpperCase());
                                }}
                                error={errors.code}
                                className="font-mono uppercase"
                                description="Se sugiere a partir del nombre; puedes cambiarlo"
                            />

                            <Select
                                label="Tipo"
                                value={data.type}
                                onChange={(e) => setData('type', e.target.value as BankType)}
                                options={types}
                                error={fieldErrors.type}
                            />

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Color de marca
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={data.brand_color || '#4f46e5'}
                                        onChange={(e) => setData('brand_color', e.target.value.toUpperCase())}
                                        aria-label="Elegir color de marca"
                                        className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                                    />
                                    <input
                                        type="text"
                                        value={data.brand_color}
                                        onChange={(e) => setData('brand_color', e.target.value.toUpperCase())}
                                        placeholder="#1D4ED8"
                                        aria-label="Color de marca en hexadecimal"
                                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm uppercase text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Tiñe el borde del logo. Se ignora si el banco no tiene logo.
                                </p>
                                {fieldErrors.brand_color ? (
                                    <p className="mt-1 text-xs text-rose-500">{fieldErrors.brand_color}</p>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
                            <Switch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Banco activo"
                                description="Solo los activos aparecen al registrar nuevos empleados"
                            />

                            {editing && employeesCount > 0 ? (
                                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                    {employeesCount} {employeesCount === 1 ? 'empleado tiene' : 'empleados tienen'}{' '}
                                    cuenta en este banco. Desactivarlo no borra sus datos de pago.
                                </p>
                            ) : null}
                        </div>
                    </Card>

                    <Card>
                        <CardHeader
                            title="Reglas de cuenta"
                            description="Son los textos que verá quien capture los datos de pago del empleado."
                        />

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Formato de cuenta"
                                value={data.account_format}
                                onChange={(e) => setData('account_format', e.target.value)}
                                error={fieldErrors.account_format}
                                placeholder="000-000000-00"
                                className="font-mono"
                                description="Se usa como marcador del campo de cuenta"
                            />

                            <Input
                                label="Ayuda del número de cuenta"
                                value={data.account_hint}
                                onChange={(e) => setData('account_hint', e.target.value)}
                                error={fieldErrors.account_hint}
                                placeholder="10 dígitos, sin guiones"
                            />
                        </div>

                        <div className="mt-4">
                            <Switch
                                checked={data.requires_key}
                                onChange={(v) => setData('requires_key', v)}
                                label="Requiere clave de dispersión"
                                description="Si se apaga, el campo de clave queda deshabilitado en la ficha del empleado"
                            />
                        </div>

                        <div className="mt-4">
                            <Textarea
                                label="Notas"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                error={fieldErrors.notes}
                                rows={3}
                                placeholder="Cuenta de 10 dígitos y clave de dispersión de 4; archivo en formato SAP."
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Aparece como aviso al elegir este banco en la ficha del empleado.
                            </p>
                        </div>
                    </Card>
                </div>

                <div className="min-w-0">
                    <Card>
                        <CardHeader title="Logo" />
                        <div className="mt-4">
                            <BankLogoField
                                name={data.name}
                                initials={previewInitials(data.code, data.name)}
                                brandColor={data.brand_color || null}
                                savedUrl={bank?.logo_url ?? null}
                                file={data.logo}
                                removed={data.logo_remove}
                                onPick={(file) =>
                                    setData((current) => ({ ...current, logo: file, logo_remove: false }))
                                }
                                onRemove={() =>
                                    setData((current) => ({
                                        ...current,
                                        logo: null,
                                        // Solo hay que pedir el borrado al servidor si lo que se
                                        // quita es un logo ya guardado.
                                        logo_remove: Boolean(bank?.logo_url),
                                    }))
                                }
                                error={fieldErrors.logo}
                            />
                        </div>
                    </Card>
                </div>
            </div>

            <StickySaveBar
                changes={changes}
                processing={processing}
                onCancel={() => reset()}
                submitLabel={editing ? 'Guardar cambios' : 'Crear banco'}
            />
        </form>
    );
}

export default BankForm;
