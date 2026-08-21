import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Can } from '@/Components/UI/Can';
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
import {
    ReferenceSaveChecklist,
    itemsChecklist,
    progresoChecklist,
} from '@/Components/References/ReferenceSaveChecklist';
import { OperationQuickCreateModal, type QuickCreatedOperation } from '@/Components/Operations/OperationQuickCreateModal';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS } from '@/lib/difficulty';
import { cn, formatCurrency } from '@/lib/utils';

interface Props {
    operations: OperationOption[];
}

export default function ReferenceCreate({ operations }: Props) {
    const page = usePage<App.PageProps>();
    const settings = page.props.activeCompany?.settings as Record<string, unknown> | null | undefined;
    const companyCurrency = typeof settings?.currency === 'string' ? settings.currency : 'COP';
    const thresholds = page.props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;

    const [availableOperations, setAvailableOperations] = useState<OperationOption[]>(operations);
    const [refOperations, setRefOperations] = useState<RefOperation[]>([]);
    const [showOperationModal, setShowOperationModal] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [detalleMovil, setDetalleMovil] = useState(false);

    /** Vista previa de la imagen elegida; se libera al cambiarla o al salir. */
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => () => {
        if (preview) URL.revokeObjectURL(preview);
    }, [preview]);

    const { data, setData, post, transform, processing, errors } = useForm({
        code: '',
        name: '',
        payment_per_unit: '' as number | '',
        description: '',
        lot_total_quantity: '' as number | '',
        image: null as File | null,
        is_active: true,
    });

    const paymentNum = data.payment_per_unit === '' ? 0 : Number(data.payment_per_unit);
    const productionCostUnit = useMemo(() => refOperations.reduce((s, r) => s + Number(r.price), 0), [refOperations]);
    const minutosTotales = useMemo(() => refOperations.reduce((s, r) => s + Number(r.estimated_minutes), 0), [refOperations]);
    const lotQtyPreview = data.lot_total_quantity === '' ? 0 : Number(data.lot_total_quantity);

    const checklist = itemsChecklist({
        code: data.code,
        name: data.name,
        payment: data.payment_per_unit,
        lote: data.lot_total_quantity,
        tieneImagen: data.image !== null,
    });
    const progreso = progresoChecklist(checklist);

    const submit = (e: FormEvent) => {
        e.preventDefault();

        // Se envia con el helper del formulario y no con `router.post` suelto: de la otra
        // manera `errors` y `processing` de useForm nunca se llenaban, y una referencia
        // rechazada por el servidor se quedaba muda, sin decir que estaba mal.
        transform((datos) => ({
            ...datos,
            operations: refOperations.map((o) => ({
                operation_id: o.operation_id,
                price: o.price,
                // La regla del servidor es `nullable|min:0.01`: un 0 no pasa nunca. Sin
                // minutos se manda vacio, que es el caso previsto para «sin dificultad».
                estimated_minutes: o.estimated_minutes > 0 ? o.estimated_minutes : null,
            })),
        }));

        post(route('references.store'), { forceFormData: true });
    };

    /**
     * Enter no envia el formulario.
     *
     * La referencia se arma por partes — datos basicos y operaciones que se agregan de a
     * una —, asi que el envio implicito del navegador la creaba a medio llenar con solo
     * pulsar Enter en cualquier campo. Se guarda unicamente desde «Guardar».
     *
     * Se deja pasar en el textarea, donde Enter es un salto de linea, y sobre un boton
     * enfocado, que es pulsarlo: cortarlo ahi dejaria el formulario sin teclado. La fila
     * de captura de operaciones detiene la tecla antes de llegar aqui, porque alli Enter
     * agrega la linea.
     */
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

    const elegirImagen = (file: File | null) => {
        setData('image', file);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : null);
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

    /**
     * Errores que el servidor devuelve por linea (`operations.0.price`…). No caben junto a
     * un campo del formulario, asi que se listan encima de la tabla; sin esto el guardado
     * fallaba en silencio.
     */
    const erroresOperaciones = Object.entries(errors)
        .filter(([clave]) => clave.startsWith('operations'))
        .map(([, mensaje]) => String(mensaje));

    /**
     * Todo lo demas que rechace el servidor y no tenga un campo donde mostrarse — la
     * empresa sin seleccionar, por ejemplo —. Sin esto, «Guardar» no hacia nada visible.
     */
    const camposConCampo = ['code', 'name', 'payment_per_unit', 'lot_total_quantity', 'description', 'image', 'is_active'];
    const erroresGenerales = Object.entries(errors)
        .filter(([clave]) => !clave.startsWith('operations') && !camposConCampo.includes(clave))
        .map(([, mensaje]) => String(mensaje));

    const margenUnitario = paymentNum - productionCostUnit;

    /* ------------------------------------------------------------ fragmentos */

    const encabezado = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-7 sm:py-4"
            style={{ backgroundColor: 'var(--ref-surface-head)', borderBottom: '1px solid var(--ref-border)' }}
        >
            {/* --- escritorio --- */}
            <div className="hidden items-center justify-between gap-4 sm:flex">
                <div className="min-w-0">
                    <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                        <Link href={route('references.index')} className="hover:underline">
                            Referencias
                        </Link>
                        <span>/</span>
                        <span>Nueva</span>
                    </nav>
                    <h1 className="mt-0.5 text-[19px]" style={{ color: 'var(--ref-text)' }}>
                        {data.name.trim() || 'Nueva referencia'}
                    </h1>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                        {progreso.hechos} de {progreso.total} para guardar
                    </span>
                    <Link href={route('references.index')} className="ref-btn">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing} className="ref-btn ref-btn-primary">
                        {processing ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* --- movil: titulo compacto + barra de 4 segmentos --- */}
            <div className="sm:hidden">
                <div className="flex items-center gap-2">
                    <Link
                        href={route('references.index')}
                        aria-label="Volver a referencias"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: 'var(--ref-muted)' }}
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Link>
                    <h1 className="min-w-0 flex-1 truncate text-[17px]" style={{ color: 'var(--ref-text)' }}>
                        {data.name.trim() || 'Nueva referencia'}
                    </h1>
                    <span className="shrink-0 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                        {progreso.hechos} de {progreso.total}
                    </span>
                </div>
                <div className="mt-2 flex gap-1" aria-hidden="true">
                    {checklist.map((item, i) => (
                        <span
                            key={item.label}
                            className="h-[3px] flex-1 rounded-full"
                            style={{ backgroundColor: item.listo ? 'var(--ref-accent)' : 'var(--ref-border)', opacity: i === 3 ? 0.6 : 1 }}
                        />
                    ))}
                </div>
            </div>
        </header>
    );

    const panel = (
        <ReferenceEconomicsPanel
            paymentPerUnit={paymentNum}
            productionCostPerUnit={productionCostUnit}
            lote={lotQtyPreview}
            currency={companyCurrency}
        >
            <ReferenceEconomicsBlock kicker="Falta para guardar">
                <ReferenceSaveChecklist items={checklist} />
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
                            ['Margen del lote', formatCurrency((paymentNum - productionCostUnit) * lotQtyPreview, companyCurrency)],
                        ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                                <dt style={{ color: 'var(--ref-muted)' }}>{k}</dt>
                                <dd style={{ color: 'var(--ref-text)' }}>{v}</dd>
                            </div>
                        ))}
                    </dl>

                    {refOperations.length > 0 ? (
                        <>
                            <p className="ref-kicker mt-3">Peso en el costo</p>
                            <ul className="mt-1.5 space-y-1 text-[12px]">
                                {refOperations.map((o) => (
                                    <li key={o.operation_id} className="flex items-center justify-between gap-3">
                                        <span className="min-w-0 truncate" style={{ color: 'var(--ref-muted)' }}>
                                            {o.name}
                                        </span>
                                        <span className="shrink-0" style={{ color: 'var(--ref-text)' }}>
                                            {productionCostUnit > 0 ? Math.round((o.price / productionCostUnit) * 100) : 0}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}

                    <div className="mt-3">
                        <p className="ref-kicker">Falta para guardar</p>
                        <div className="mt-1.5">
                            <ReferenceSaveChecklist items={checklist} />
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                    <span className="ref-kicker">Margen unitario</span>
                    <span className="text-[22px] leading-none" style={{ color: margenUnitario < 0 ? 'var(--ref-danger)' : 'var(--ref-text)' }}>
                        {formatCurrency(margenUnitario, companyCurrency)}
                        {paymentNum > 0 ? (
                            <span className="ml-1.5 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                {Math.round((margenUnitario / paymentNum) * 1000) / 10}%
                            </span>
                        ) : null}
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
                        {processing ? 'Guardando…' : 'Guardar referencia'}
                    </button>
                </div>
            </div>
        </>
    );

    /* ---------------------------------------------------------------- render */

    return (
        <AppLayout title="Nueva referencia">
            <Head title="Nueva referencia" />
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
                    <ReferenceFormSection step={1} title="Identidad" summary={data.code.trim() || undefined}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="shrink-0">
                                {/*
                                  * El input vive fuera del label para que «Cambiar» pueda
                                  * dispararlo: con una imagen puesta, el clic sobre la
                                  * miniatura lo toma el visor y ya no abre el selector.
                                  */}
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
                                            alt={data.name || 'Imagen de la referencia'}
                                            title={data.name || 'Imagen de la referencia'}
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
                                        <button
                                            type="button"
                                            onClick={() => elegirImagen(null)}
                                            className="mt-1 h-9 w-full text-[11px] sm:h-6"
                                            style={{ color: 'var(--ref-danger)' }}
                                        >
                                            Quitar
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[150px_1fr]">
                                <div className="min-w-0">
                                    <label htmlFor="ref-code" className="ref-label">
                                        Código
                                    </label>
                                    <input
                                        id="ref-code"
                                        value={data.code}
                                        onChange={(e) => setData('code', e.target.value)}
                                        className={cn('ref-field', errors.code && 'ref-field-error')}
                                        required
                                    />
                                    {errors.code ? (
                                        <p className="ref-help" style={{ color: 'var(--ref-danger)' }}>
                                            {errors.code}
                                        </p>
                                    ) : null}
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
                        </div>
                    </ReferenceFormSection>

                    {/* --------------------------------------- 2 · Dinero y lote */}
                    <ReferenceFormSection
                        step={2}
                        title="Dinero y lote"
                        summary={paymentNum > 0 ? `${formatCurrency(paymentNum, companyCurrency)} / u.` : undefined}
                    >
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
                                    required
                                />
                                <p className="ref-help">
                                    {errors.payment_per_unit ?? (
                                        <>
                                            Lo que <strong style={{ color: 'var(--ref-muted)' }}>reciben</strong> por unidad entregada.
                                        </>
                                    )}
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
                                    className={cn('ref-field', errors.lot_total_quantity && 'ref-field-error')}
                                    required
                                />
                                <p className="ref-help">{errors.lot_total_quantity ?? 'Tope de unidades por operación.'}</p>
                            </div>

                            {/* El switch va dentro del mismo borde que los campos: la fila lee como tres campos. */}
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
                            <Can permission="operations.index.create">
                                <button type="button" onClick={() => setShowOperationModal(true)} className="ref-btn ref-btn-sm">
                                    <PlusIcon className="h-3.5 w-3.5" />
                                    Crear operación nueva
                                </button>
                            </Can>
                        }
                    >
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
                        />
                    </ReferenceFormSection>
                </ReferenceFormLayout>
            </form>

            <OperationQuickCreateModal
                open={showOperationModal}
                onClose={() => setShowOperationModal(false)}
                onCreated={handleOperationCreated}
            />
        </AppLayout>
    );
}
