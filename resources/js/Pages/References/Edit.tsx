import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathIcon, LockClosedIcon, PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import { Switch } from '@/Components/UI/Switch';
import { ReferenceEconomicsBlock, ReferenceEconomicsPanel } from '@/Components/References/ReferenceEconomicsPanel';
import { ReferenceFormLayout } from '@/Components/References/ReferenceFormLayout';
import { ReferenceFormSection } from '@/Components/References/ReferenceFormSection';
import {
    ReferenceOperationsTable,
    type OperationOption,
    type RefOperation,
} from '@/Components/References/ReferenceOperationsTable';
import { OperationQuickCreateModal, type QuickCreatedOperation } from '@/Components/Operations/OperationQuickCreateModal';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS } from '@/lib/difficulty';
import { cn, formatCurrency } from '@/lib/utils';
import type { Reference, ReferenceEconomicsComparison, ReferenceOperationPivot } from '@/types';

interface Props {
    reference: Reference & { operations: ReferenceOperationPivot[] };
    operations: OperationOption[];
    comparison: ReferenceEconomicsComparison;
    /** Maximo acumulado en una sola operacion: lo que bloquea el codigo y limita el lote. */
    producedMax?: number;
}

/** Minutos de la linea; cero es «sin medir», no un tiempo real. */
function lineMinutes(op: ReferenceOperationPivot): number {
    const raw = op.pivot.estimated_minutes ?? op.estimated_minutes;
    const value = raw != null && raw !== '' ? Number(raw) : NaN;

    return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function ReferenceEdit({ reference, operations, comparison, producedMax = 0 }: Props) {
    const page = usePage<App.PageProps>();
    const thresholds = page.props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const companyCurrency = comparison.currency;

    const detalleInicial = useMemo<RefOperation[]>(
        () =>
            (reference.operations ?? []).map((op) => ({
                operation_id: op.id,
                name: op.name,
                price: Number(op.pivot.price),
                estimated_minutes: lineMinutes(op),
                is_active: Boolean(op.pivot.is_active),
            })),
        [reference.operations],
    );

    const [availableOperations, setAvailableOperations] = useState<OperationOption[]>(operations);
    const [refOperations, setRefOperations] = useState<RefOperation[]>(detalleInicial);
    const [showOperationModal, setShowOperationModal] = useState(false);
    const [confirmarRecalculo, setConfirmarRecalculo] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [detalleMovil, setDetalleMovil] = useState(false);
    const [abiertas, setAbiertas] = useState<string[]>([]);

    /** Vista previa: la imagen actual hasta que se elija otra. */
    const [preview, setPreview] = useState<string | null>(reference.image ?? null);

    useEffect(() => () => {
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    }, [preview]);

    const { data, setData, post, transform, processing, errors } = useForm({
        code: reference.code,
        name: reference.name,
        payment_per_unit:
            reference.payment_per_unit != null && reference.payment_per_unit !== ''
                ? (Number(reference.payment_per_unit) as number | '')
                : ('' as number | ''),
        description: reference.description ?? '',
        lot_total_quantity: (reference.lot_total_quantity ?? '') as number | '',
        image: null as File | null,
        is_active: reference.is_active,
    });

    const paymentNum = data.payment_per_unit === '' ? 0 : Number(data.payment_per_unit);
    const productionCostUnit = useMemo(() => refOperations.reduce((s, r) => s + Number(r.price), 0), [refOperations]);
    const minutosTotales = useMemo(() => refOperations.reduce((s, r) => s + Number(r.estimated_minutes), 0), [refOperations]);
    const lotQty = data.lot_total_quantity === '' ? 0 : Number(data.lot_total_quantity);
    const margenUnitario = paymentNum - productionCostUnit;

    /** El detalle cambia por su cuenta: `isDirty` de useForm no lo ve. */
    const detalleCambiado = useMemo(() => {
        const clave = (l: RefOperation[]) =>
            JSON.stringify([...l].sort((a, b) => a.operation_id - b.operation_id).map((o) => [o.operation_id, o.price, o.estimated_minutes]));

        return clave(refOperations) !== clave(detalleInicial);
    }, [refOperations, detalleInicial]);

    const cambios = useMemo(() => {
        const lista: string[] = [];
        if (data.code !== reference.code) lista.push('Código');
        if (data.name !== reference.name) lista.push('Nombre');
        if (String(data.payment_per_unit) !== String(reference.payment_per_unit != null ? Number(reference.payment_per_unit) : '')) lista.push('Valor unitario de pago');
        if (String(data.lot_total_quantity) !== String(reference.lot_total_quantity ?? '')) lista.push('Cantidad del lote');
        if (data.description !== (reference.description ?? '')) lista.push('Descripción');
        if (data.is_active !== reference.is_active) lista.push('Estado');
        if (data.image !== null) lista.push('Imagen');
        if (detalleCambiado) lista.push('Detalle de operaciones');

        return lista;
    }, [data, reference, detalleCambiado]);

    const haycambios = cambios.length > 0;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        transform((datos) => ({
            ...datos,
            _method: 'put',
            operations: refOperations.map((o) => ({
                operation_id: o.operation_id,
                price: o.price,
                // La regla del servidor es `nullable|min:0.01`: un 0 no pasa nunca.
                estimated_minutes: o.estimated_minutes > 0 ? o.estimated_minutes : null,
            })),
        }));

        post(route('references.update', reference.id), { forceFormData: true });
    };

    /** Enter no envia el formulario; la fila de captura lo detiene antes de llegar aqui. */
    const bloquearEnvioConEnter = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter') return;

        const destino = e.target as HTMLElement | null;
        if (destino?.tagName === 'TEXTAREA' || destino?.tagName === 'BUTTON') return;

        e.preventDefault();
    };

    const addOperation = (linea: RefOperation) => {
        setRefOperations((prev) => (prev.some((r) => r.operation_id === linea.operation_id) ? prev : [...prev, linea]));
    };

    const removeOp = (id: number) => setRefOperations((prev) => prev.filter((r) => r.operation_id !== id));

    const cambiarPrecio = (id: number, precio: number) =>
        setRefOperations((prev) => prev.map((r) => (r.operation_id === id ? { ...r, price: precio } : r)));

    const cambiarMinutos = (id: number, minutos: number) =>
        setRefOperations((prev) => prev.map((r) => (r.operation_id === id ? { ...r, estimated_minutes: minutos } : r)));

    const elegirImagen = (file: File | null) => {
        setData('image', file);
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : (reference.image ?? null));
    };

    const handleOperationCreated = (op: QuickCreatedOperation) => {
        setAvailableOperations((prev) => [...prev, op].sort((a, b) => a.name.localeCompare(b.name)));
        setRefOperations((prev) => [
            ...prev,
            { operation_id: op.id, name: op.name, price: Number(op.base_price), estimated_minutes: Number(op.estimated_minutes) },
        ]);
        setShowOperationModal(false);
    };

    const alSoltarImagen = (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        setDragOver(false);
        const archivo = e.dataTransfer.files?.[0];
        if (archivo && archivo.type.startsWith('image/')) elegirImagen(archivo);
    };

    const recalcular = () => {
        setConfirmarRecalculo(false);
        router.post(route('references.operations.recalculate', reference.id), {}, { preserveScroll: true });
    };

    const erroresOperaciones = Object.entries(errors)
        .filter(([clave]) => clave.startsWith('operations'))
        .map(([, mensaje]) => String(mensaje));

    const camposConCampo = ['code', 'name', 'payment_per_unit', 'lot_total_quantity', 'description', 'image', 'is_active'];
    const erroresGenerales = Object.entries(errors)
        .filter(([clave]) => !clave.startsWith('operations') && !camposConCampo.includes(clave))
        .map(([, mensaje]) => String(mensaje));

    const codigoBloqueado = producedMax > 0;

    /* ------------------------------------------------------------ fragmentos */

    const encabezado = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-7 sm:py-4"
            style={{ backgroundColor: 'var(--ref-surface-head)', borderBottom: '1px solid var(--ref-border)' }}
        >
            <div className="hidden items-center justify-between gap-4 sm:flex">
                <div className="min-w-0">
                    <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                        <Link href={route('references.index')} className="hover:underline">
                            Referencias
                        </Link>
                        <span>/</span>
                        <Link href={route('references.show', reference.id)} className="hover:underline">
                            {reference.code}
                        </Link>
                        <span>/</span>
                        <span>Editar</span>
                    </nav>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <h1 className="text-[19px]" style={{ color: 'var(--ref-text)' }}>
                            {data.name.trim() || reference.name}
                        </h1>
                        <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{ border: '1px solid var(--ref-border)', color: data.is_active ? 'var(--ref-ok)' : 'var(--ref-muted)' }}
                        >
                            {data.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[12px]" style={{ color: haycambios ? 'var(--ref-accent-on)' : 'var(--ref-muted)' }}>
                        {haycambios ? `${cambios.length} ${cambios.length === 1 ? 'cambio' : 'cambios'} sin guardar` : 'Sin cambios'}
                    </span>
                    <Link href={route('references.show', reference.id)} className="ref-btn">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Descartar
                    </Link>
                    <button type="submit" disabled={processing} className="ref-btn ref-btn-primary">
                        {processing ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* --- movil --- */}
            <div className="sm:hidden">
                <div className="flex items-center gap-2">
                    <Link
                        href={route('references.show', reference.id)}
                        aria-label="Volver a la referencia"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: 'var(--ref-muted)' }}
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Link>
                    <h1 className="min-w-0 flex-1 truncate text-[17px]" style={{ color: 'var(--ref-text)' }}>
                        {data.name.trim() || reference.name}
                    </h1>
                    <span className="shrink-0 text-[12px]" style={{ color: haycambios ? 'var(--ref-accent-on)' : 'var(--ref-muted)' }}>
                        {haycambios ? `${cambios.length} sin guardar` : 'Sin cambios'}
                    </span>
                </div>
            </div>
        </header>
    );

    const panel = (
        <ReferenceEconomicsPanel
            paymentPerUnit={paymentNum}
            productionCostPerUnit={productionCostUnit}
            lote={lotQty}
            currency={companyCurrency}
        >
            {/* Comparacion contra lo guardado: cuanto mueve la edicion en curso. */}
            {Math.abs(comparison.margin_per_unit - margenUnitario) > 0.001 ? (
                <ReferenceEconomicsBlock kicker="Antes de tus cambios">
                    <p className="text-[13px]" style={{ color: 'var(--ref-muted)' }}>
                        {formatCurrency(comparison.margin_per_unit, companyCurrency)}
                        <span style={{ color: margenUnitario >= comparison.margin_per_unit ? 'var(--ref-ok)' : 'var(--ref-danger)' }}>
                            {' · '}
                            {margenUnitario >= comparison.margin_per_unit ? '+' : '−'}
                            {formatCurrency(Math.abs(margenUnitario - comparison.margin_per_unit), companyCurrency)}
                        </span>
                    </p>
                </ReferenceEconomicsBlock>
            ) : null}

            <ReferenceEconomicsBlock kicker="Producción registrada">
                <p className="text-[15px]" style={{ color: 'var(--ref-text)' }}>
                    {producedMax.toLocaleString('es-CO')}
                    {lotQty > 0 ? <span style={{ color: 'var(--ref-muted)' }}> de {lotQty.toLocaleString('es-CO')}</span> : null}
                </p>
                {lotQty > 0 ? (
                    <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ref-accent-track)' }} aria-hidden="true">
                        <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, Math.round((producedMax / lotQty) * 100))}%`, backgroundColor: 'var(--ref-accent)' }}
                        />
                    </div>
                ) : null}
                <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                    Cuenta la operación más avanzada; el lote no puede bajar de ahí.
                </p>
            </ReferenceEconomicsBlock>

            <ReferenceEconomicsBlock kicker="Cambios sin guardar">
                {haycambios ? (
                    <ul className="space-y-1 text-[12px]">
                        {cambios.map((c) => (
                            <li key={c} className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--ref-accent)' }} />
                                <span style={{ color: 'var(--ref-text)' }}>{c}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                        Nada por guardar todavía.
                    </p>
                )}
            </ReferenceEconomicsBlock>
        </ReferenceEconomicsPanel>
    );

    const barraMovil = (
        <>
            {detalleMovil ? (
                <div className="max-h-[50vh] overflow-y-auto px-4 py-3" style={{ borderBottom: '1px solid var(--ref-border)' }}>
                    <dl className="space-y-1.5 text-[12px]">
                        {[
                            ['Pago por unidad', formatCurrency(paymentNum, companyCurrency)],
                            ['Costo operacional', formatCurrency(productionCostUnit, companyCurrency)],
                            ['Margen del lote', formatCurrency(margenUnitario * lotQty, companyCurrency)],
                            ['Producción registrada', producedMax.toLocaleString('es-CO')],
                        ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3">
                                <dt style={{ color: 'var(--ref-muted)' }}>{k}</dt>
                                <dd style={{ color: 'var(--ref-text)' }}>{v}</dd>
                            </div>
                        ))}
                    </dl>
                    {haycambios ? (
                        <>
                            <p className="ref-kicker mt-3">Cambios sin guardar</p>
                            <p className="mt-1 text-[12px]" style={{ color: 'var(--ref-text)' }}>
                                {cambios.join(' · ')}
                            </p>
                        </>
                    ) : null}
                </div>
            ) : null}

            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                    <span className="ref-kicker">Margen unitario</span>
                    <span className="text-[22px] leading-none" style={{ color: margenUnitario < 0 ? 'var(--ref-danger)' : 'var(--ref-text)' }}>
                        {formatCurrency(margenUnitario, companyCurrency)}
                    </span>
                </div>
                <div className="mt-2 flex h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ref-accent-track)' }} aria-hidden="true">
                    <span
                        style={{
                            width: `${Math.max(paymentNum, productionCostUnit) > 0 ? Math.min(100, (productionCostUnit / Math.max(paymentNum, productionCostUnit)) * 100) : 0}%`,
                            backgroundColor: 'var(--ref-accent-on)',
                        }}
                    />
                    <span className="flex-1" style={{ backgroundColor: 'var(--ref-accent)' }} />
                </div>
                <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={() => setDetalleMovil((v) => !v)} className="ref-btn flex-1">
                        {detalleMovil ? 'Ocultar' : 'Ver detalle'}
                    </button>
                    <button type="submit" disabled={processing} className="ref-btn ref-btn-primary flex-[2]">
                        {processing ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </>
    );

    /**
     * En movil las secciones arrancan plegadas: editar un precio no debe obligar a
     * recorrer el formulario entero. En escritorio siempre estan abiertas.
     */
    const plegable = (clave: string, resumen: string, contenido: React.ReactNode) => {
        const abierta = abiertas.includes(clave);

        return (
            <>
                <button
                    type="button"
                    onClick={() => setAbiertas((a) => (abierta ? a.filter((k) => k !== clave) : [...a, clave]))}
                    className="flex h-12 w-full items-center justify-between gap-2 text-left sm:hidden"
                >
                    <span className="min-w-0 truncate text-[13px]" style={{ color: 'var(--ref-muted)' }}>
                        {resumen}
                    </span>
                    <span className="shrink-0 text-[13px]" style={{ color: 'var(--ref-subtle)' }}>
                        {abierta ? '⌃' : '›'}
                    </span>
                </button>
                <div className={cn('sm:block', abierta ? 'block' : 'hidden')}>{contenido}</div>
            </>
        );
    };

    /* ---------------------------------------------------------------- render */

    return (
        <AppLayout title={`Editar ${reference.code}`}>
            <Head title={`Editar ${reference.code}`} />
            <form onSubmit={submit} onKeyDown={bloquearEnvioConEnter}>
                <ReferenceFormLayout header={encabezado} aside={panel} mobileBar={barraMovil}>
                    {erroresGenerales.length > 0 ? (
                        <div
                            role="alert"
                            className="rounded-[10px] px-3.5 py-2.5 text-[13px]"
                            style={{ border: '1px solid var(--ref-danger)', color: 'var(--ref-danger)' }}
                        >
                            {erroresGenerales.map((mensaje) => (
                                <p key={mensaje}>{mensaje}</p>
                            ))}
                        </div>
                    ) : null}

                    {/* ------------------------------------------- 1 · Identidad */}
                    <ReferenceFormSection
                        step={1}
                        title="Identidad"
                        summary={data.code.trim() || undefined}
                        action={cambios.includes('Código') || cambios.includes('Nombre') || cambios.includes('Descripción') || cambios.includes('Imagen') ? <PillEditado /> : undefined}
                    >
                        {plegable(
                            'identidad',
                            `Identidad · ${data.name.trim() || reference.name}`,
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="shrink-0">
                                    <input
                                        id="ref-imagen"
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={(e) => {
                                            elegirImagen(e.target.files?.[0] ?? null);
                                            e.target.value = '';
                                        }}
                                    />
                                    <label
                                        htmlFor="ref-imagen"
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDragOver(true);
                                        }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={alSoltarImagen}
                                        className="flex h-[104px] w-[104px] cursor-pointer items-center justify-center overflow-hidden rounded-[10px]"
                                        style={{
                                            border: `1px ${preview ? 'solid' : 'dashed'} ${dragOver ? 'var(--ref-accent)' : 'var(--ref-border)'}`,
                                            backgroundColor: dragOver ? 'var(--ref-accent-soft)' : 'var(--ref-surface)',
                                        }}
                                    >
                                        {preview ? (
                                            <ZoomableImage
                                                src={preview}
                                                alt={data.name || reference.name}
                                                title={`${data.code || reference.code} — ${data.name || reference.name}`}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="px-2 text-center text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                                <PhotoIcon className="mx-auto h-6 w-6" />
                                                <span className="mt-1 block">Arrastra o elige</span>
                                            </span>
                                        )}
                                    </label>

                                    {preview ? (
                                        <div className="mt-1.5 w-[104px]">
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('ref-imagen')?.click()}
                                                className="ref-btn ref-btn-sm w-full"
                                            >
                                                Cambiar
                                            </button>
                                            {data.image ? (
                                                <button
                                                    type="button"
                                                    onClick={() => elegirImagen(null)}
                                                    className="mt-1 h-9 w-full text-[11px] sm:h-6"
                                                    style={{ color: 'var(--ref-danger)' }}
                                                >
                                                    Descartar la nueva
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[150px_1fr]">
                                    <div className="min-w-0">
                                        <label htmlFor="ref-code" className="ref-label">
                                            Código
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="ref-code"
                                                value={data.code}
                                                readOnly={codigoBloqueado}
                                                onChange={(e) => setData('code', e.target.value)}
                                                className={cn('ref-field', errors.code && 'ref-field-error', codigoBloqueado && 'pr-9')}
                                                style={
                                                    codigoBloqueado
                                                        ? { borderStyle: 'dashed', backgroundColor: 'var(--ref-surface-head)', color: 'var(--ref-muted)' }
                                                        : undefined
                                                }
                                                required
                                            />
                                            {codigoBloqueado ? (
                                                <LockClosedIcon
                                                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                                                    style={{ color: 'var(--ref-subtle)' }}
                                                />
                                            ) : null}
                                        </div>
                                        <p className="ref-help" style={errors.code ? { color: 'var(--ref-danger)' } : undefined}>
                                            {errors.code ?? (codigoBloqueado ? 'Con producción registrada no se cambia.' : '')}
                                        </p>
                                    </div>

                                    <div className="min-w-0">
                                        <label htmlFor="ref-name" className="ref-label">
                                            Nombre
                                        </label>
                                        <input
                                            id="ref-name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            className={cn('ref-field', errors.name && 'ref-field-error')}
                                            required
                                        />
                                        {errors.name ? (
                                            <p className="ref-help" style={{ color: 'var(--ref-danger)' }}>
                                                {errors.name}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="min-w-0 sm:col-span-2">
                                        <label htmlFor="ref-desc" className="ref-label">
                                            Descripción <span style={{ color: 'var(--ref-subtle)' }}>— opcional</span>
                                        </label>
                                        <textarea
                                            id="ref-desc"
                                            rows={2}
                                            value={data.description}
                                            onChange={(e) => setData('description', e.target.value)}
                                            className="ref-field"
                                        />
                                    </div>
                                </div>
                            </div>,
                        )}
                    </ReferenceFormSection>

                    {/* --------------------------------------- 2 · Dinero y lote */}
                    <ReferenceFormSection
                        step={2}
                        title="Dinero y lote"
                        summary={paymentNum > 0 ? `${formatCurrency(paymentNum, companyCurrency)} / u.` : undefined}
                        action={cambios.includes('Valor unitario de pago') || cambios.includes('Cantidad del lote') || cambios.includes('Estado') ? <PillEditado /> : undefined}
                    >
                        {plegable(
                            'dinero',
                            `Dinero y lote · ${formatCurrency(paymentNum, companyCurrency)}`,
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <div className="min-w-0">
                                        <label htmlFor="ref-pago" className="ref-label">
                                            Valor unitario de pago
                                        </label>
                                        <input
                                            id="ref-pago"
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            inputMode="decimal"
                                            value={data.payment_per_unit}
                                            onChange={(e) =>
                                                setData('payment_per_unit', e.target.value === '' ? ('' as number | '') : Number(e.target.value))
                                            }
                                            className={cn('ref-field', errors.payment_per_unit && 'ref-field-error')}
                                        />
                                        <p className="ref-help" style={errors.payment_per_unit ? { color: 'var(--ref-danger)' } : undefined}>
                                            {errors.payment_per_unit ??
                                                (comparison.payment_per_unit_incomplete
                                                    ? 'Sin definir hasta ahora.'
                                                    : `Antes ${formatCurrency(comparison.payment_per_unit, companyCurrency)}`)}
                                        </p>
                                    </div>

                                    <div className="min-w-0">
                                        <label htmlFor="ref-lote" className="ref-label">
                                            Cantidad total del lote
                                        </label>
                                        <input
                                            id="ref-lote"
                                            type="number"
                                            step="1"
                                            min={1}
                                            inputMode="numeric"
                                            value={data.lot_total_quantity}
                                            onChange={(e) =>
                                                setData('lot_total_quantity', e.target.value === '' ? ('' as number | '') : Number(e.target.value))
                                            }
                                            className={cn(
                                                'ref-field',
                                                errors.lot_total_quantity && 'ref-field-error',
                                            )}
                                            style={
                                                cambios.includes('Cantidad del lote') && !errors.lot_total_quantity
                                                    ? { borderColor: 'var(--ref-accent)' }
                                                    : undefined
                                            }
                                            required
                                        />
                                        <p className="ref-help" style={errors.lot_total_quantity ? { color: 'var(--ref-danger)' } : undefined}>
                                            {errors.lot_total_quantity ??
                                                (producedMax > 0
                                                    ? `No puede bajar de ${producedMax.toLocaleString('es-CO')} ya producidas.`
                                                    : 'Tope de unidades por operación.')}
                                        </p>
                                    </div>

                                    <div className="col-span-2 min-w-0 sm:col-span-1">
                                        <span className="ref-label">Estado</span>
                                        <div
                                            className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 sm:min-h-[38px]"
                                            style={{ border: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-[13px]" style={{ color: 'var(--ref-text)' }}>
                                                    Activa
                                                </span>
                                                <span className="block text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                                    Admite producción
                                                </span>
                                            </span>
                                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} />
                                        </div>
                                    </div>
                                </div>

                                {producedMax > 0 ? (
                                    <p
                                        className="mt-3 py-1.5 pl-3 text-[12px]"
                                        style={{ borderLeft: '2px solid var(--ref-accent)', color: 'var(--ref-muted)' }}
                                    >
                                        Esta referencia ya tiene <strong style={{ color: 'var(--ref-text)' }}>{producedMax.toLocaleString('es-CO')} unidades producidas</strong>.
                                        Cambiar precios de operaciones altera el costo de aquí en adelante; lo ya registrado conserva el precio con el que se pagó.
                                    </p>
                                ) : null}
                            </>,
                        )}
                    </ReferenceFormSection>

                    {/* ---------------------------------------- 3 · Operaciones */}
                    <ReferenceFormSection
                        step={3}
                        title="Operaciones"
                        summary={
                            refOperations.length > 0
                                ? `${refOperations.length} ${refOperations.length === 1 ? 'línea' : 'líneas'} · ${minutosTotales.toLocaleString('es-CO')} min · ${formatCurrency(productionCostUnit, companyCurrency)} / u.`
                                : undefined
                        }
                        action={
                            <span className="flex flex-wrap items-center justify-end gap-1.5">
                                {detalleCambiado ? <PillEditado /> : null}
                                <button
                                    type="button"
                                    onClick={() => setConfirmarRecalculo(true)}
                                    disabled={haycambios}
                                    title={
                                        haycambios
                                            ? 'Guarda los cambios antes de recalcular: el recálculo recarga la pantalla y perderías lo escrito.'
                                            : 'Reaplica los rangos de dificultad de Mi empresa a estas líneas.'
                                    }
                                    className="ref-btn ref-btn-sm"
                                >
                                    <ArrowPathIcon className="h-3.5 w-3.5" />
                                    Recalcular dificultades
                                </button>
                                <Can permission="operations.index.create">
                                    <button type="button" onClick={() => setShowOperationModal(true)} className="ref-btn ref-btn-sm">
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        Crear operación nueva
                                    </button>
                                </Can>
                            </span>
                        }
                    >
                        {plegable(
                            'operaciones',
                            `Operaciones · ${refOperations.length} · ${formatCurrency(productionCostUnit, companyCurrency)}`,
                            <>
                                {erroresOperaciones.length > 0 ? (
                                    <ul
                                        className="mb-3 space-y-1 rounded-lg px-3 py-2 text-[12px]"
                                        style={{ border: '1px solid var(--ref-danger)', color: 'var(--ref-danger)' }}
                                    >
                                        {erroresOperaciones.map((mensaje) => (
                                            <li key={mensaje}>{mensaje}</li>
                                        ))}
                                    </ul>
                                ) : null}

                                <ReferenceOperationsTable
                                    lineas={refOperations}
                                    disponibles={availableOperations}
                                    thresholds={thresholds}
                                    currency={companyCurrency}
                                    onAgregar={addOperation}
                                    onQuitar={removeOp}
                                    onPrecio={cambiarPrecio}
                                    onMinutos={cambiarMinutos}
                                />
                            </>,
                        )}
                    </ReferenceFormSection>
                </ReferenceFormLayout>
            </form>

            <OperationQuickCreateModal
                open={showOperationModal}
                onClose={() => setShowOperationModal(false)}
                onCreated={handleOperationCreated}
            />

            <ConfirmDialog
                open={confirmarRecalculo}
                onClose={() => setConfirmarRecalculo(false)}
                onConfirm={recalcular}
                title="Recalcular dificultades"
                message="Se reaplican los rangos de minutos de Mi empresa a las líneas de esta referencia. La pantalla se recarga con los valores nuevos."
                confirmText="Recalcular"
            />
        </AppLayout>
    );
}

/** Marca de sección tocada, para localizar los cambios de un vistazo. */
function PillEditado() {
    return (
        <span
            className="rounded-full px-2 py-0.5 text-[11px]"
            style={{ backgroundColor: 'var(--ref-accent-soft)', color: 'var(--ref-accent-on)' }}
        >
            editado
        </span>
    );
}
