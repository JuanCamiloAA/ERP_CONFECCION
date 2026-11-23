import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathRoundedSquareIcon, ArrowUturnLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { OperationQuickCreateModal, type QuickCreatedOperation } from '@/Components/Operations/OperationQuickCreateModal';
import { Can } from '@/Components/UI/Can';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { ReferenceEconomicsBlock, ReferenceEconomicsPanel } from '@/Components/References/ReferenceEconomicsPanel';
import { ReferenceFormLayout } from '@/Components/References/ReferenceFormLayout';
import { ReferenceFormSection } from '@/Components/References/ReferenceFormSection';
import {
    ReferenceOperationsTable,
    type OperationOption,
    type RefOperation,
} from '@/Components/References/ReferenceOperationsTable';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS } from '@/lib/difficulty';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { Reference, ReferenceEconomicsComparison, ReferenceOperationPivot } from '@/types';

interface CurrentLot {
    lot_number: number;
    started_at: string | null;
    /** Unidades de la operacion mas avanzada. */
    produced_max: number;
    operations_completed: number;
    operations_total: number;
    /** Unidades por operation_id (clave string) en la programacion vigente. */
    produced_by_operation: Record<string, number>;
}

interface Props {
    reference: Reference & { operations: ReferenceOperationPivot[] };
    /** Catalogo de la empresa, para agregar operaciones a la programacion nueva. */
    operations: OperationOption[];
    comparison: ReferenceEconomicsComparison;
    currentLot: CurrentLot;
}

type Monto = number | '';

const aNumero = (valor: Monto): number => (valor === '' ? 0 : Number(valor));

/** Minutos de la linea; cero es «sin medir», no un tiempo real. */
function lineMinutes(op: ReferenceOperationPivot): number {
    const raw = op.pivot.estimated_minutes ?? op.estimated_minutes;
    const value = raw != null && raw !== '' ? Number(raw) : NaN;

    return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Reprogramar una referencia.
 *
 * Cuando el cliente vuelve a pedir la misma prenda no hace falta otra referencia: se abre
 * una programacion nueva con su propia cantidad, su valor por unidad y el precio de cada
 * operacion. La programacion vigente queda en el historial tal como esta, con lo que se
 * produjo y lo que se pago, y el conteo del lote vuelve a empezar.
 *
 * Comparte armazon con crear y editar: secciones numeradas a la izquierda y el panel de
 * economia —ya con los valores nuevos— fijo a la derecha.
 */
export default function ReferenceReprogram({ reference, operations, comparison, currentLot }: Props) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const currency = comparison.currency;
    const siguiente = currentLot.lot_number + 1;
    const loteActual = Number(reference.lot_total_quantity ?? 0);

    const [confirmar, setConfirmar] = useState(false);
    const [detalleMovil, setDetalleMovil] = useState(false);
    const [crearOperacion, setCrearOperacion] = useState(false);

    /** Detalle de la programacion que se cierra: punto de partida y referencia de comparacion. */
    const detalleInicial = useMemo<RefOperation[]>(
        () =>
            (reference.operations ?? []).map((op) => ({
                operation_id: op.id,
                name: op.name,
                price: Number(op.pivot.price),
                estimated_minutes: lineMinutes(op),
            })),
        [reference.operations],
    );

    const preciosAntes = useMemo(
        () => Object.fromEntries(detalleInicial.map((l) => [l.operation_id, l.price])) as Record<number, number>,
        [detalleInicial],
    );

    /** Detalle de la programacion nueva: se le agregan, quitan y reprecian lineas. */
    const [lineas, setLineas] = useState<RefOperation[]>(detalleInicial);
    const [catalogo, setCatalogo] = useState<OperationOption[]>(operations);

    const { data, setData, post, transform, processing, errors } = useForm({
        lot_total_quantity: (loteActual > 0 ? loteActual : '') as Monto,
        payment_per_unit: (comparison.payment_per_unit_incomplete ? '' : comparison.payment_per_unit) as Monto,
    });

    /* --------------------------------------------------- cifras derivadas */

    const pagoNuevo = aNumero(data.payment_per_unit);
    const loteNuevo = aNumero(data.lot_total_quantity);
    const costoNuevo = lineas.reduce((s, l) => s + Number(l.price), 0);
    const margenNuevo = pagoNuevo - costoNuevo;
    const margenAntes = comparison.margin_per_unit;

    /** Operaciones que no alcanzaron el lote en la programacion que se cierra. */
    const sinTerminar =
        loteActual > 0 ? detalleInicial.filter((l) => Number(currentLot.produced_by_operation?.[String(l.operation_id)] ?? 0) < loteActual) : [];
    const completa = loteActual > 0 && detalleInicial.length > 0 && sinTerminar.length === 0;
    const sinProduccion = currentLot.produced_max <= 0;

    /* Lo que cambia en el detalle frente a la programacion que se cierra. */
    const agregadas = lineas.filter((l) => preciosAntes[l.operation_id] === undefined);
    const quitadas = detalleInicial.filter((l) => !lineas.some((n) => n.operation_id === l.operation_id));
    const repreciadas = lineas.filter(
        (l) => preciosAntes[l.operation_id] !== undefined && Math.abs(Number(l.price) - preciosAntes[l.operation_id]) > 0.001,
    );
    const detalleCambiado = agregadas.length + quitadas.length + repreciadas.length > 0;

    const desde = currentLot.started_at ? formatDate(currentLot.started_at, "d 'de' MMMM yyyy") : null;

    /* --------------------------------------------------------- acciones */

    const agregar = (linea: RefOperation) =>
        setLineas((prev) => (prev.some((l) => l.operation_id === linea.operation_id) ? prev : [...prev, linea]));

    const quitar = (id: number) => setLineas((prev) => prev.filter((l) => l.operation_id !== id));

    /** Vuelve a poner una linea quitada, con los valores que tenia. */
    const deshacerQuitar = (id: number) => {
        const original = detalleInicial.find((l) => l.operation_id === id);
        if (original) agregar(original);
    };

    const cambiarPrecio = (id: number, precio: number) =>
        setLineas((prev) => prev.map((l) => (l.operation_id === id ? { ...l, price: precio } : l)));

    const cambiarMinutos = (id: number, minutos: number) =>
        setLineas((prev) => prev.map((l) => (l.operation_id === id ? { ...l, estimated_minutes: minutos } : l)));

    /**
     * Ajuste rapido: sube el precio de las operaciones que ya tenia la referencia un
     * porcentaje sobre su valor anterior (no se acumula al pulsar dos veces). Las nuevas
     * conservan el precio con el que se agregaron.
     */
    const ajustarTodos = (porcentaje: number) =>
        setLineas((prev) =>
            prev.map((l) => {
                const antes = preciosAntes[l.operation_id];

                return antes === undefined ? l : { ...l, price: Math.round(antes * (1 + porcentaje / 100) * 100) / 100 };
            }),
        );

    const restaurar = () => setLineas(detalleInicial);

    const operacionCreada = (op: QuickCreatedOperation) => {
        setCatalogo((prev) => [...prev, op].sort((a, b) => a.name.localeCompare(b.name)));
        agregar({ operation_id: op.id, name: op.name, price: Number(op.base_price), estimated_minutes: Number(op.estimated_minutes) });
        setCrearOperacion(false);
    };

    const pedirConfirmacion = (e: FormEvent) => {
        e.preventDefault();
        setConfirmar(true);
    };

    const enviar = () => {
        transform((d) => ({
            lot_total_quantity: d.lot_total_quantity,
            payment_per_unit: d.payment_per_unit,
            // La lista completa: lo que no vaya se quita de la programacion nueva.
            operations: lineas.map((l) => ({
                operation_id: l.operation_id,
                price: l.price,
                // La regla del servidor es `nullable|min:0.01`: un 0 no pasa nunca.
                estimated_minutes: l.estimated_minutes > 0 ? l.estimated_minutes : null,
            })),
        }));

        post(route('references.reprogram.store', reference.id), {
            preserveScroll: true,
            onFinish: () => setConfirmar(false),
        });
    };

    /** Enter en un campo no dispara la reprogramacion: es una accion que se confirma. */
    const bloquearEnter = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName === 'INPUT') e.preventDefault();
    };

    // El servidor responde con claves que no son campos del formulario (`reprogram`,
    // `operations`, `operations.N.price`): se leen como diccionario.
    const errores = errors as Record<string, string | undefined>;
    const erroresGenerales = errores.reprogram ? [errores.reprogram] : [];
    const erroresOperaciones = [
        ...new Set(
            Object.entries(errores)
                .filter(([k, v]) => k.startsWith('operations') && v)
                .map(([, v]) => String(v)),
        ),
    ];

    const resumenCambios = [
        agregadas.length > 0 ? `${agregadas.length} ${agregadas.length === 1 ? 'operación nueva' : 'operaciones nuevas'}` : null,
        quitadas.length > 0 ? `${quitadas.length} ${quitadas.length === 1 ? 'operación quitada' : 'operaciones quitadas'}` : null,
        repreciadas.length > 0 ? `${repreciadas.length} con precio nuevo` : null,
    ].filter(Boolean) as string[];

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
                        <span>Reprogramar</span>
                    </nav>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <h1 className="text-[19px]" style={{ color: 'var(--ref-text)' }}>
                            Reprogramar {reference.code} · {reference.name}
                        </h1>
                        <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={{ backgroundColor: 'var(--ref-accent-soft)', color: 'var(--ref-accent-on)' }}
                        >
                            Programación {currentLot.lot_number} → {siguiente}
                        </span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <Link href={route('references.show', reference.id)} className="ref-btn">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Cancelar
                    </Link>
                    <button type="submit" disabled={processing || sinProduccion || lineas.length === 0} className="ref-btn ref-btn-primary">
                        <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                        {processing ? 'Reprogramando…' : 'Reprogramar'}
                    </button>
                </div>
            </div>

            {/* --- movil --- */}
            <div className="flex items-center gap-2 sm:hidden">
                <Link
                    href={route('references.show', reference.id)}
                    aria-label="Volver a la referencia"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: 'var(--ref-muted)' }}
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px]" style={{ color: 'var(--ref-text)' }}>
                        Reprogramar {reference.code}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                        Programación {currentLot.lot_number} → {siguiente}
                    </p>
                </div>
            </div>
        </header>
    );

    const panel = (
        <ReferenceEconomicsPanel paymentPerUnit={pagoNuevo} productionCostPerUnit={costoNuevo} lote={loteNuevo} currency={currency}>
            {Math.abs(margenNuevo - margenAntes) > 0.001 ? (
                <ReferenceEconomicsBlock kicker={`Frente a la programación ${currentLot.lot_number}`}>
                    <p className="text-[13px]" style={{ color: 'var(--ref-muted)' }}>
                        Margen antes {formatCurrency(margenAntes, currency)}
                        <span style={{ color: margenNuevo >= margenAntes ? 'var(--ref-ok)' : 'var(--ref-danger)' }}>
                            {' · '}
                            {margenNuevo >= margenAntes ? '+' : '−'}
                            {formatCurrency(Math.abs(margenNuevo - margenAntes), currency)} por unidad
                        </span>
                    </p>
                </ReferenceEconomicsBlock>
            ) : null}

            <ReferenceEconomicsBlock kicker="Cambios en operaciones">
                {detalleCambiado ? (
                    <ul className="space-y-1 text-[12px]">
                        {agregadas.map((l) => (
                            <li key={`a${l.operation_id}`} className="flex justify-between gap-2">
                                <span className="min-w-0 truncate" style={{ color: 'var(--ref-ok)' }}>
                                    + {l.name}
                                </span>
                                <span style={{ color: 'var(--ref-text)' }}>{formatCurrency(l.price, currency)}</span>
                            </li>
                        ))}
                        {quitadas.map((l) => (
                            <li key={`q${l.operation_id}`} className="flex justify-between gap-2">
                                <span className="min-w-0 truncate line-through" style={{ color: 'var(--ref-danger)' }}>
                                    − {l.name}
                                </span>
                                <span style={{ color: 'var(--ref-muted)' }}>{formatCurrency(l.price, currency)}</span>
                            </li>
                        ))}
                        {repreciadas.map((l) => (
                            <li key={`p${l.operation_id}`} className="flex justify-between gap-2">
                                <span className="min-w-0 truncate" style={{ color: 'var(--ref-text)' }}>
                                    {l.name}
                                </span>
                                <span style={{ color: 'var(--ref-muted)' }}>
                                    {formatCurrency(preciosAntes[l.operation_id], currency)} → {formatCurrency(l.price, currency)}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                        Mismas operaciones y precios que la programación {currentLot.lot_number}.
                    </p>
                )}
            </ReferenceEconomicsBlock>

            <ReferenceEconomicsBlock kicker="Al reprogramar">
                <ul className="space-y-1.5 text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                    {[
                        `La programación ${currentLot.lot_number} queda en el historial con lo producido y sus valores.`,
                        'El conteo del lote vuelve a cero: se puede registrar producción de nuevo.',
                        'Lo ya registrado conserva su precio y sigue disponible para nómina.',
                        'Las operaciones quitadas dejan de ofrecerse al registrar; lo que ya se produjo con ellas se conserva.',
                    ].map((t) => (
                        <li key={t} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--ref-accent)' }} />
                            <span>{t}</span>
                        </li>
                    ))}
                </ul>
            </ReferenceEconomicsBlock>
        </ReferenceEconomicsPanel>
    );

    const barraMovil = (
        <>
            {detalleMovil ? (
                <div className="max-h-[50vh] overflow-y-auto px-4 py-3" style={{ borderBottom: '1px solid var(--ref-border)' }}>
                    <dl className="space-y-1.5 text-[12px]">
                        {[
                            ['Lote nuevo', loteNuevo > 0 ? `${formatNumber(loteNuevo)} u.` : '—'],
                            ['Pago por unidad', formatCurrency(pagoNuevo, currency)],
                            ['Costo operacional', formatCurrency(costoNuevo, currency)],
                            ['Margen del lote', formatCurrency(margenNuevo * loteNuevo, currency)],
                            [`Margen programación ${currentLot.lot_number}`, formatCurrency(margenAntes, currency)],
                            ['Operaciones', resumenCambios.length > 0 ? resumenCambios.join(' · ') : 'Sin cambios'],
                        ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3">
                                <dt style={{ color: 'var(--ref-muted)' }}>{k}</dt>
                                <dd style={{ color: 'var(--ref-text)' }}>{v}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ) : null}

            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-baseline justify-between">
                    <span className="ref-kicker">Margen unitario nuevo</span>
                    <span className="text-[22px] leading-none" style={{ color: margenNuevo < 0 ? 'var(--ref-danger)' : 'var(--ref-text)' }}>
                        {formatCurrency(margenNuevo, currency)}
                    </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                    <button type="button" onClick={() => setDetalleMovil((v) => !v)} className="ref-btn flex-1">
                        {detalleMovil ? 'Ocultar' : 'Ver detalle'}
                    </button>
                    <button type="submit" disabled={processing || sinProduccion || lineas.length === 0} className="ref-btn ref-btn-primary flex-[2]">
                        {processing ? 'Reprogramando…' : 'Reprogramar'}
                    </button>
                </div>
            </div>
        </>
    );

    const caja = (titulo: string, valor: string, ayuda: string) => (
        <div className="min-w-0 rounded-lg px-3 py-2.5" style={{ border: '1px solid var(--ref-border)', backgroundColor: 'var(--ref-surface)' }}>
            <p className="text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                {titulo}
            </p>
            <p className="mt-0.5 text-[16px]" style={{ color: 'var(--ref-text)' }}>
                {valor}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ref-subtle)' }}>
                {ayuda}
            </p>
        </div>
    );

    /* ---------------------------------------------------------------- render */

    return (
        <AppLayout title={`Reprogramar ${reference.code}`}>
            <Head title={`Reprogramar ${reference.code}`} />

            <form onSubmit={pedirConfirmacion} onKeyDown={bloquearEnter}>
                <ReferenceFormLayout header={encabezado} aside={panel} mobileBar={barraMovil}>
                    {erroresGenerales.length > 0 ? (
                        <div
                            role="alert"
                            className="rounded-[10px] px-3.5 py-2.5 text-[13px]"
                            style={{ border: '1px solid var(--ref-danger)', color: 'var(--ref-danger)' }}
                        >
                            {erroresGenerales.map((m) => (
                                <p key={m}>{m}</p>
                            ))}
                        </div>
                    ) : null}

                    {/* ------------------------------------- Programacion que se cierra */}
                    <ReferenceFormSection
                        title={`Programación ${currentLot.lot_number} · la que se cierra`}
                        summary={desde ? `desde el ${desde}` : undefined}
                    >
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {caja('Lote', loteActual > 0 ? `${formatNumber(loteActual)} u.` : '—', 'Tope por operación.')}
                            {caja(
                                'Pago por unidad',
                                comparison.payment_per_unit_incomplete ? 'Sin definir' : formatCurrency(comparison.payment_per_unit, currency),
                                'Valor vigente.',
                            )}
                            {caja('Producidas', `${formatNumber(currentLot.produced_max)} u.`, 'En la operación más avanzada.')}
                            {caja(
                                'Operaciones completas',
                                `${formatNumber(currentLot.operations_completed)} de ${formatNumber(currentLot.operations_total)}`,
                                completa ? 'Lote terminado.' : 'Con el lote cubierto.',
                            )}
                        </div>

                        {sinProduccion ? (
                            <p
                                className="mt-3 py-1.5 pl-3 text-[12px]"
                                style={{ borderLeft: '2px solid var(--ref-danger)', color: 'var(--ref-muted)' }}
                            >
                                Esta programación todavía no tiene producción registrada. Para cambiar la cantidad o el valor no hace falta
                                reprogramar:{' '}
                                <Link href={route('references.edit', reference.id)} className="underline" style={{ color: 'var(--ref-text)' }}>
                                    edita la referencia
                                </Link>
                                .
                            </p>
                        ) : !completa && sinTerminar.length > 0 ? (
                            <p
                                className="mt-3 py-1.5 pl-3 text-[12px]"
                                style={{ borderLeft: '2px solid var(--ref-accent)', color: 'var(--ref-muted)' }}
                            >
                                {sinTerminar.length === 1 ? 'Una operación no ha' : `${sinTerminar.length} operaciones no han`} cubierto el
                                lote de {formatNumber(loteActual)} u. ({sinTerminar.map((l) => l.name).join(', ')}). Al reprogramar, esta
                                programación se cierra tal como está: lo pendiente no pasa a la nueva.
                            </p>
                        ) : null}
                    </ReferenceFormSection>

                    {/* ------------------------------------------- 1 · Cantidad y valor */}
                    <ReferenceFormSection step={1} title={`Programación ${siguiente} · cantidad y valor`}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="min-w-0">
                                <label htmlFor="rep-lote" className="ref-label">
                                    Cantidad del lote nuevo
                                </label>
                                <input
                                    id="rep-lote"
                                    type="number"
                                    step="1"
                                    min={1}
                                    inputMode="numeric"
                                    value={data.lot_total_quantity}
                                    onChange={(e) => setData('lot_total_quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                    className={cn('ref-field', errors.lot_total_quantity && 'ref-field-error')}
                                    required
                                    autoFocus
                                />
                                <p className="ref-help" style={errors.lot_total_quantity ? { color: 'var(--ref-danger)' } : undefined}>
                                    {errors.lot_total_quantity ??
                                        (loteActual > 0 ? `Antes ${formatNumber(loteActual)} u. · arranca desde cero.` : 'Tope de unidades por operación.')}
                                </p>
                            </div>

                            <div className="min-w-0">
                                <label htmlFor="rep-pago" className="ref-label">
                                    Valor unitario de pago
                                </label>
                                <input
                                    id="rep-pago"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    inputMode="decimal"
                                    value={data.payment_per_unit}
                                    onChange={(e) => setData('payment_per_unit', e.target.value === '' ? '' : Number(e.target.value))}
                                    className={cn('ref-field', errors.payment_per_unit && 'ref-field-error')}
                                    required
                                />
                                <p className="ref-help" style={errors.payment_per_unit ? { color: 'var(--ref-danger)' } : undefined}>
                                    {errors.payment_per_unit ??
                                        (comparison.payment_per_unit_incomplete
                                            ? 'Sin definir hasta ahora.'
                                            : `Antes ${formatCurrency(comparison.payment_per_unit, currency)}`)}
                                </p>
                            </div>
                        </div>
                    </ReferenceFormSection>

                    {/* ------------------------------------------- 2 · Operaciones */}
                    <ReferenceFormSection
                        step={2}
                        title="Operaciones y valores"
                        summary={
                            lineas.length > 0
                                ? `${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'} · ${formatCurrency(costoNuevo, currency)} / u.${
                                      resumenCambios.length > 0 ? ` · ${resumenCambios.join(' · ')}` : ''
                                  }`
                                : 'Sin operaciones'
                        }
                        action={
                            <span className="flex flex-wrap items-center justify-end gap-1.5">
                                {[5, 10].map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => ajustarTodos(p)}
                                        disabled={detalleInicial.length === 0}
                                        title={`Sube ${p}% el precio de las operaciones que ya tenía, sobre su valor anterior.`}
                                        className="ref-btn ref-btn-sm"
                                    >
                                        +{p}% a todas
                                    </button>
                                ))}
                                {detalleCambiado ? (
                                    <button type="button" onClick={restaurar} className="ref-btn ref-btn-sm">
                                        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                        Restaurar
                                    </button>
                                ) : null}
                                <Can permission="operations.index.create">
                                    <button type="button" onClick={() => setCrearOperacion(true)} className="ref-btn ref-btn-sm">
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        Crear operación nueva
                                    </button>
                                </Can>
                            </span>
                        }
                    >
                        {erroresOperaciones.length > 0 ? (
                            <ul
                                className="mb-3 space-y-1 rounded-lg px-3 py-2 text-[12px]"
                                style={{ border: '1px solid var(--ref-danger)', color: 'var(--ref-danger)' }}
                            >
                                {erroresOperaciones.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        ) : null}

                        <ReferenceOperationsTable
                            lineas={lineas}
                            disponibles={catalogo}
                            thresholds={thresholds}
                            currency={currency}
                            previousPrices={preciosAntes}
                            onAgregar={agregar}
                            onQuitar={quitar}
                            onPrecio={cambiarPrecio}
                            onMinutos={cambiarMinutos}
                        />

                        {/* Lo quitado sigue a la vista: quitar por error no debe obligar a buscarla otra vez. */}
                        {quitadas.length > 0 ? (
                            <div className="mt-3 rounded-[10px] px-3 py-2.5" style={{ border: '1px dashed var(--ref-border)' }}>
                                <p className="text-[12px]" style={{ color: 'var(--ref-muted)' }}>
                                    No van en la programación {siguiente}
                                </p>
                                <ul className="mt-1.5 space-y-1">
                                    {quitadas.map((l) => (
                                        <li key={l.operation_id} className="flex items-center justify-between gap-3 text-[13px]">
                                            <span className="min-w-0 truncate line-through" style={{ color: 'var(--ref-subtle)' }}>
                                                {l.name} · {formatCurrency(l.price, currency)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => deshacerQuitar(l.operation_id)}
                                                className="ref-btn ref-btn-sm shrink-0"
                                            >
                                                <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                                Deshacer
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {lineas.length === 0 ? (
                            <p className="mt-2.5 text-[12px]" style={{ color: 'var(--ref-danger)' }}>
                                La programación {siguiente} necesita al menos una operación.
                            </p>
                        ) : null}

                        <p className="mt-2.5 text-[12px]" style={{ color: 'var(--ref-subtle)' }}>
                            Agrega las operaciones que este pedido sí lleva y quita las que no. El precio es lo que se le paga al operario por
                            unidad; los cambios rigen solo para lo que se registre en la programación {siguiente}. Lo ya producido con las
                            operaciones quitadas se conserva en el historial.
                        </p>
                    </ReferenceFormSection>
                </ReferenceFormLayout>
            </form>

            <ConfirmDialog
                open={confirmar}
                onClose={() => setConfirmar(false)}
                onConfirm={enviar}
                title={`Reprogramar ${reference.code}`}
                message={`Se cierra la programación ${currentLot.lot_number} y se abre la ${siguiente} con un lote de ${formatNumber(loteNuevo)} unidades a ${formatCurrency(pagoNuevo, currency)} por unidad y ${lineas.length} ${lineas.length === 1 ? 'operación' : 'operaciones'}${resumenCambios.length > 0 ? ` (${resumenCambios.join(', ')})` : ''}. Lo ya producido se conserva en el historial. Esta acción no se puede deshacer.`}
                confirmText="Reprogramar"
                variant="primary"
                loading={processing}
            />

            <OperationQuickCreateModal
                open={crearOperacion}
                onClose={() => setCrearOperacion(false)}
                onCreated={operacionCreada}
                contextLabel={`Reprogramación ${siguiente} · ${reference.code} · ${reference.name}`}
            />
        </AppLayout>
    );
}
