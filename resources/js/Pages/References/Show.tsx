import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowDownTrayIcon, ArrowLeftIcon, DocumentDuplicateIcon, PencilSquareIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { ReferenceEconomicsBlock, ReferenceEconomicsPanel } from '@/Components/References/ReferenceEconomicsPanel';
import { ReferenceExportMenu } from '@/Components/References/ReferenceExportMenu';
import { ReferenceFormLayout } from '@/Components/References/ReferenceFormLayout';
import { ReferenceFormSection } from '@/Components/References/ReferenceFormSection';
import { ReferenceOperationsTable, type RefOperation } from '@/Components/References/ReferenceOperationsTable';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ZoomableImage } from '@/Components/UI/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS } from '@/lib/difficulty';
import { formatCurrency } from '@/lib/utils';
import type { Reference, ReferenceEconomicsComparison, ReferenceOperationPivot } from '@/types';

interface Props {
    reference: Reference & {
        operations: ReferenceOperationPivot[];
        productions_sum_quantity?: number | null;
        /** Maximo acumulado en una sola operacion: es lo comparable contra el lote. */
        productions_max_per_operation?: number | null;
    };
    comparison: ReferenceEconomicsComparison;
}

/**
 * Minutos que rigen la linea: los suyos y, si no los tiene, los estandar de la operacion.
 * Cero es «sin medir», no un tiempo real, asi que se trata como ausencia de dato.
 */
function lineMinutes(op: ReferenceOperationPivot): number | null {
    const raw = op.pivot.estimated_minutes ?? op.estimated_minutes;
    const value = raw != null && raw !== '' ? Number(raw) : NaN;

    return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Ficha de la referencia: solo visualizacion.
 *
 * Todo lo que escribe vive en el formulario de edicion. Aqui no hay campos ni formulario:
 * la pantalla comparte armazon, secciones y panel con crear y editar, y se distingue por
 * no tener numeros de paso ni controles de captura.
 */
export default function ReferenceShow({ reference, comparison }: Props) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const [confirmarDuplicar, setConfirmarDuplicar] = useState(false);
    const [confirmarEliminar, setConfirmarEliminar] = useState(false);
    const [enCurso, setEnCurso] = useState(false);
    const [detalleMovil, setDetalleMovil] = useState(false);

    const currency = comparison.currency;
    const pago = comparison.payment_per_unit;
    const costo = comparison.production_cost_per_unit;
    const lote = comparison.operational_lot_qty;
    const pagoSinDefinir = comparison.payment_per_unit_incomplete;
    const margen = pago - costo;

    const producidas = Number(reference.productions_max_per_operation ?? 0);
    const avance = lote > 0 ? Math.min(100, Math.round((producidas / lote) * 100)) : null;

    /** El detalle, en la forma que espera la tabla compartida. */
    const lineas: RefOperation[] = useMemo(
        () =>
            (reference.operations ?? []).map((op) => ({
                operation_id: op.id,
                name: op.name,
                price: Number(op.pivot.price),
                estimated_minutes: lineMinutes(op) ?? 0,
                is_active: Boolean(op.pivot.is_active),
            })),
        [reference.operations],
    );

    const minutosTotales = lineas.reduce((s, l) => s + l.estimated_minutes, 0);

    const duplicar = () => {
        if (enCurso) return;
        setEnCurso(true);
        router.post(route('references.duplicate', reference.id), {}, { onFinish: () => setEnCurso(false) });
    };

    const eliminar = () => {
        if (enCurso) return;
        setEnCurso(true);
        router.delete(route('references.destroy', reference.id), { onFinish: () => setEnCurso(false) });
    };

    /* ------------------------------------------------------------ fragmentos */

    const editada = reference.updated_at ? new Date(reference.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

    const encabezado = (
        <header
            className="sticky top-0 z-30 px-4 py-3 sm:px-7 sm:py-4"
            style={{ backgroundColor: 'var(--ref-surface-head)', borderBottom: '1px solid var(--ref-border)' }}
        >
            <div className="hidden items-center justify-between gap-4 sm:flex">
                <div className="flex min-w-0 items-center gap-3">
                    {/* Volver al listado: la miga de pan sola no se lee como salida. */}
                    <Link href={route('references.index')} className="ref-btn shrink-0" aria-label="Volver a la lista de referencias">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Volver
                    </Link>
                    <div className="min-w-0">
                        <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                            <Link href={route('references.index')} className="hover:underline">
                                Referencias
                            </Link>
                            <span>/</span>
                            <span>{reference.code}</span>
                        </nav>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <h1 className="text-[19px]" style={{ color: 'var(--ref-text)' }}>
                                {reference.code} · {reference.name}
                            </h1>
                            <span
                                className="rounded-full px-2 py-0.5 text-[11px]"
                                style={{
                                    border: '1px solid var(--ref-border)',
                                    color: reference.is_active ? 'var(--ref-ok)' : 'var(--ref-muted)',
                                }}
                            >
                                {reference.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                        {editada ? (
                            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                                Editada el {editada}
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <ReferenceExportMenu
                        ids={[reference.id]}
                        hint={`Ficha completa de ${reference.code}: imagen, operaciones y costo operacional.`}
                        buttonClassName="ref-btn"
                    />
                    <Can permission="references.index.create">
                        <button type="button" onClick={() => setConfirmarDuplicar(true)} disabled={enCurso} className="ref-btn">
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            Duplicar
                        </button>
                    </Can>
                    <Can permission="references.index.delete">
                        <button
                            type="button"
                            onClick={() => setConfirmarEliminar(true)}
                            disabled={enCurso}
                            className="ref-btn"
                            style={{ color: 'var(--ref-danger)' }}
                        >
                            <TrashIcon className="h-4 w-4" />
                            Eliminar
                        </button>
                    </Can>
                    <Can permission="references.index.edit">
                        <Link href={route('references.edit', reference.id)} className="ref-btn ref-btn-primary">
                            <PencilSquareIcon className="h-4 w-4" />
                            Editar referencia
                        </Link>
                    </Can>
                </div>
            </div>

            {/* --- movil --- */}
            <div className="flex items-center gap-2 sm:hidden">
                <Link
                    href={route('references.index')}
                    aria-label="Volver a referencias"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: 'var(--ref-muted)' }}
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px]" style={{ color: 'var(--ref-text)' }}>
                        {reference.code}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                        {reference.name}
                    </p>
                </div>
                <ReferenceExportMenu
                    ids={[reference.id]}
                    hint={`Ficha completa de ${reference.code}: imagen, operaciones y costo operacional.`}
                    buttonClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    trigger={<ArrowDownTrayIcon className="h-5 w-5" style={{ color: 'var(--ref-muted)' }} />}
                />
                <Can permission="references.index.create">
                    <button
                        type="button"
                        onClick={() => setConfirmarDuplicar(true)}
                        aria-label="Duplicar referencia"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: 'var(--ref-muted)' }}
                    >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                    </button>
                </Can>
                <Can permission="references.index.delete">
                    <button
                        type="button"
                        onClick={() => setConfirmarEliminar(true)}
                        aria-label="Eliminar referencia"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: 'var(--ref-danger)' }}
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </Can>
            </div>
        </header>
    );

    const caja = (titulo: string, valor: string, ayuda: string) => (
        <div className="min-w-0 rounded-lg px-3 py-2.5" style={{ border: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}>
            <p className="text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                {titulo}
            </p>
            <p className="mt-0.5 text-[18px]" style={{ color: 'var(--ref-text)' }}>
                {valor}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                {ayuda}
            </p>
        </div>
    );

    const panel = (
        <ReferenceEconomicsPanel paymentPerUnit={pago} productionCostPerUnit={costo} lote={lote} currency={currency}>
            <ReferenceEconomicsBlock kicker="Producción registrada">
                <p className="text-[15px]" style={{ color: 'var(--ref-text)' }}>
                    {producidas.toLocaleString('es-CO')}
                    {lote > 0 ? <span style={{ color: 'var(--ref-muted)' }}> de {lote.toLocaleString('es-CO')}</span> : null}
                </p>
                {avance !== null ? (
                    <>
                        <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ref-accent-track)' }} aria-hidden="true">
                            <span className="block h-full rounded-full" style={{ width: `${avance}%`, backgroundColor: 'var(--ref-accent)' }} />
                        </div>
                        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                            {avance}% del lote, contando la operación más avanzada.
                        </p>
                    </>
                ) : (
                    <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                        Sin lote definido, no hay avance que calcular.
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
                            ['Pago por unidad', pagoSinDefinir ? 'Sin definir' : formatCurrency(pago, currency)],
                            ['Costo operacional', formatCurrency(costo, currency)],
                            ['Margen del lote', pagoSinDefinir ? '—' : formatCurrency(margen * lote, currency)],
                            ['Producción registrada', `${producidas.toLocaleString('es-CO')}${lote > 0 ? ` de ${lote.toLocaleString('es-CO')}` : ''}`],
                        ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3">
                                <dt style={{ color: 'var(--ref-muted)' }}>{k}</dt>
                                <dd style={{ color: 'var(--ref-text)' }}>{v}</dd>
                            </div>
                        ))}
                    </dl>

                    {lineas.length > 0 ? (
                        <>
                            <p className="ref-kicker mt-3">Peso en el costo</p>
                            <ul className="mt-1.5 space-y-1 text-[12px]">
                                {lineas.map((o) => (
                                    <li key={o.operation_id} className="flex items-center justify-between gap-3">
                                        <span className="min-w-0 truncate" style={{ color: 'var(--ref-muted)' }}>
                                            {o.name}
                                        </span>
                                        <span className="shrink-0" style={{ color: 'var(--ref-text)' }}>
                                            {costo > 0 ? Math.round((o.price / costo) * 100) : 0}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                </div>
            ) : null}

            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                    <span className="ref-kicker">Margen unitario</span>
                    <span className="text-[22px] leading-none" style={{ color: margen < 0 ? 'var(--ref-danger)' : 'var(--ref-text)' }}>
                        {pagoSinDefinir ? 'Sin definir' : formatCurrency(margen, currency)}
                        {!pagoSinDefinir && pago > 0 ? (
                            <span className="ml-1.5 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                {Math.round((margen / pago) * 1000) / 10}%
                            </span>
                        ) : null}
                    </span>
                </div>
                <div className="mt-2 flex h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--ref-accent-track)' }} aria-hidden="true">
                    <span
                        style={{
                            width: `${Math.max(pago, costo) > 0 ? Math.min(100, (costo / Math.max(pago, costo)) * 100) : 0}%`,
                            backgroundColor: 'var(--ref-accent-on)',
                        }}
                    />
                    <span className="flex-1" style={{ backgroundColor: 'var(--ref-accent)' }} />
                </div>
                <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={() => setDetalleMovil((v) => !v)} className="ref-btn flex-1">
                        {detalleMovil ? 'Ocultar' : 'Ver detalle'}
                    </button>
                    <Can permission="references.index.edit">
                        <Link href={route('references.edit', reference.id)} className="ref-btn ref-btn-primary flex-[2]">
                            Editar referencia
                        </Link>
                    </Can>
                </div>
            </div>
        </>
    );

    /* ---------------------------------------------------------------- render */

    return (
        <AppLayout title={reference.code}>
            <Head title={`${reference.code} · ${reference.name}`} />

            <ReferenceFormLayout header={encabezado} aside={panel} mobileBar={barraMovil}>
                {/* ------------------------------------------------- Identidad */}
                <ReferenceFormSection title="Identidad">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div
                            className="flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                            style={{ border: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}
                        >
                            {reference.image ? (
                                <ZoomableImage
                                    src={reference.image}
                                    alt={reference.name}
                                    title={`${reference.code} — ${reference.name}`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <TagIcon className="h-8 w-8" style={{ color: 'var(--ref-subtle)' }} />
                            )}
                        </div>

                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[150px_1fr]">
                            <div className="min-w-0">
                                <p className="ref-label">Código</p>
                                <p className="text-[14px]" style={{ color: 'var(--ref-text)' }}>
                                    {reference.code}
                                </p>
                            </div>
                            <div className="min-w-0">
                                <p className="ref-label">Nombre</p>
                                <p className="text-[14px]" style={{ color: 'var(--ref-text)' }}>
                                    {reference.name}
                                </p>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                                <p className="ref-label">Descripción</p>
                                <p
                                    className="whitespace-pre-line text-[13px]"
                                    style={{ color: reference.description ? 'var(--ref-text)' : 'var(--ref-subtle)' }}
                                >
                                    {reference.description || 'Sin descripción.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </ReferenceFormSection>

                {/* --------------------------------------------- Dinero y lote */}
                <ReferenceFormSection title="Dinero y lote">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {caja(
                            'Valor unitario de pago',
                            pagoSinDefinir ? 'Sin definir' : formatCurrency(pago, currency),
                            'Lo que reciben por unidad entregada.',
                        )}
                        {caja(
                            'Cantidad total del lote',
                            lote > 0 ? lote.toLocaleString('es-CO') : '—',
                            'Tope de unidades por operación.',
                        )}
                        <div className="col-span-2 sm:col-span-1">
                            {caja(
                                'Estado',
                                reference.is_active ? 'Activa' : 'Inactiva',
                                reference.is_active ? 'Admite producción.' : 'No se ofrece al registrar producción.',
                            )}
                        </div>
                    </div>
                </ReferenceFormSection>

                {/* ----------------------------------------------- Operaciones */}
                <ReferenceFormSection
                    title="Operaciones"
                    summary={
                        lineas.length > 0
                            ? `${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'} · ${minutosTotales.toLocaleString('es-CO')} min · ${formatCurrency(costo, currency)} / u.`
                            : 'Sin operaciones vinculadas'
                    }
                >
                    <ReferenceOperationsTable
                        readOnly
                        lineas={lineas}
                        disponibles={[]}
                        thresholds={thresholds}
                        currency={currency}
                        onAgregar={() => {}}
                        onQuitar={() => {}}
                    />
                </ReferenceFormSection>
            </ReferenceFormLayout>

            <ConfirmDialog
                open={confirmarDuplicar}
                onClose={() => setConfirmarDuplicar(false)}
                onConfirm={duplicar}
                title="Duplicar referencia"
                message={`Se crea una copia de «${reference.code}» con su detalle de operaciones, sin la imagen ni las producciones. Podrás ajustar el código antes de guardar.`}
                confirmText="Duplicar"
                loading={enCurso}
            />

            <ConfirmDialog
                open={confirmarEliminar}
                onClose={() => setConfirmarEliminar(false)}
                onConfirm={eliminar}
                title="Eliminar referencia"
                message="Se elimina la referencia y su detalle de operaciones. Esta acción no se puede deshacer."
                confirmText="Eliminar"
                variant="danger"
                loading={enCurso}
            />
        </AppLayout>
    );
}
