import { useForm } from '@inertiajs/react';
import { CaretDown, CaretUpDown, Image as ImageIcon, Minus, Plus } from '@phosphor-icons/react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { SearchSheet, type SearchSheetItem } from '@/Components/UI/SearchSheet';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Employee, ReferenceOperationPivot } from '@/types';
import '../../../css/module-ui.css';

export interface ReferenceWithOps {
    id: number;
    code: string;
    name: string;
    image?: string | null;
    lot_total_quantity?: number | null;
    productions_sum_quantity?: number | null;
    productions_quantity_by_operation?: Record<string, number>;
    operations: ReferenceOperationPivot[];
}

const LAST_REFERENCE_STORAGE_KEY = 'production-register-form:last-reference-id';
const RECENT_REFERENCES_STORAGE_KEY = 'production-register-form:recent-reference-ids';

function readCachedReferenceId(): number | '' {
    if (typeof window === 'undefined') {
        return '';
    }
    const raw = window.localStorage.getItem(LAST_REFERENCE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : '';
}

function readRecentReferenceIds(): number[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_REFERENCES_STORAGE_KEY) ?? '[]');

        return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(id)).slice(0, 3) : [];
    } catch {
        return [];
    }
}

function pushRecentReferenceId(id: number): number[] {
    const next = [id, ...readRecentReferenceIds().filter((r) => r !== id)].slice(0, 3);
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_REFERENCES_STORAGE_KEY, JSON.stringify(next));
    }

    return next;
}

interface ProductionRegisterFormProps {
    references: ReferenceWithOps[];
    employees?: Employee[];
    /** Si se define, el empleado queda fijo (usuario operario). */
    lockedEmployeeId?: number;
    lockedEmployeeName?: string;
    submitButtonText?: string;
    /** Enlace del boton «Cancelar» de la barra inferior; sin el, no se pinta. */
    cancelHref?: string;
}

/** Campo de una linea que abre una hoja de busqueda (referencias / operaciones pueden ser cientos). */
function PickerField({
    label,
    required,
    error,
    disabled,
    placeholder,
    primary,
    secondary,
    leading,
    onOpen,
}: {
    label: string;
    required?: boolean;
    error?: string;
    disabled?: boolean;
    placeholder: string;
    primary?: string;
    secondary?: string;
    leading?: ReactNode;
    onOpen: () => void;
}) {
    return (
        <div className="w-full min-w-0">
            <label className="emp-label">
                {label} {required ? <span className="emp-req">*</span> : null}
            </label>
            <button
                type="button"
                onClick={onOpen}
                disabled={disabled}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left ${error ? 'emp-field-error' : ''}`}
                style={{
                    minHeight: '56px',
                    border: `1px solid ${error ? 'var(--emp-danger)' : 'var(--emp-border)'}`,
                    backgroundColor: 'var(--emp-field)',
                    opacity: disabled ? 0.55 : 1,
                }}
            >
                {leading}
                <span className="min-w-0 flex-1">
                    {primary ? (
                        <>
                            <span className="block truncate text-[14px]" style={{ color: 'var(--emp-text)' }}>
                                {primary}
                            </span>
                            {secondary ? (
                                <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--emp-muted)' }}>
                                    {secondary}
                                </span>
                            ) : null}
                        </>
                    ) : (
                        <span className="text-[14px]" style={{ color: 'var(--emp-subtle)' }}>
                            {placeholder}
                        </span>
                    )}
                </span>
                <CaretUpDown size={16} className="shrink-0" style={{ color: 'var(--emp-subtle)' }} />
            </button>
            {error ? <p className="emp-error">{error}</p> : null}
        </div>
    );
}

export function ProductionRegisterForm({
    references,
    employees = [],
    lockedEmployeeId,
    lockedEmployeeName,
    submitButtonText = 'Guardar registro',
    cancelHref,
}: ProductionRegisterFormProps) {
    const isWorkerLocked = Boolean(lockedEmployeeId && lockedEmployeeName);

    const initialReferenceId = useMemo(() => {
        const cached = readCachedReferenceId();

        return cached !== '' && references.some((r) => r.id === cached) ? cached : '';
    }, [references]);

    const [recentReferenceIds, setRecentReferenceIds] = useState<number[]>(() => readRecentReferenceIds());
    const [referenceSheetOpen, setReferenceSheetOpen] = useState(false);
    const [operationSheetOpen, setOperationSheetOpen] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        employee_id: (lockedEmployeeId ?? '') as number | '',
        reference_id: initialReferenceId as number | '',
        operation_id: '' as number | '',
        quantity: 1,
        unit_price: '' as string,
        date: new Date().toISOString().split('T')[0],
        shift: 'manana',
        notes: '',
    });

    const selectedReference = useMemo(
        () => references.find((r) => r.id === Number(data.reference_id)),
        [data.reference_id, references],
    );
    const availableOperations = selectedReference?.operations ?? [];
    const selectedOperation = availableOperations.find((o) => o.id === Number(data.operation_id));

    const lotCapInfo = useMemo(() => {
        const ref = selectedReference;
        if (!ref || ref.lot_total_quantity == null) {
            return {
                cap: null as number | null,
                registeredThisOperation: null as number | null,
                remaining: null as number | null,
            };
        }
        const cap = Number(ref.lot_total_quantity);
        const opId = data.operation_id ? Number(data.operation_id) : null;
        const byOp = ref.productions_quantity_by_operation ?? {};
        if (!opId) {
            return { cap, registeredThisOperation: null, remaining: null };
        }
        const registered = Number(byOp[String(opId)] ?? 0);

        return {
            cap,
            registeredThisOperation: registered,
            remaining: Math.max(0, cap - registered),
        };
    }, [selectedReference, data.operation_id]);

    useEffect(() => {
        if (lotCapInfo.remaining != null && lotCapInfo.remaining > 0 && data.quantity > lotCapInfo.remaining) {
            setData('quantity', lotCapInfo.remaining);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedReference?.id, data.operation_id, lotCapInfo.remaining]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (data.reference_id) {
            window.localStorage.setItem(LAST_REFERENCE_STORAGE_KEY, String(data.reference_id));
        }
    }, [data.reference_id]);

    useEffect(() => {
        if (data.operation_id && availableOperations.length > 0) {
            const op = availableOperations.find((o) => o.id === Number(data.operation_id));
            if (op) {
                setData('unit_price', String(op.pivot.price));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.operation_id, data.reference_id]);

    const total = (data.quantity || 0) * Number(data.unit_price || 0);
    const maxQuantity = lotCapInfo.remaining != null ? lotCapInfo.remaining || undefined : (lotCapInfo.cap ?? undefined);
    const lotClosed = lotCapInfo.remaining != null && lotCapInfo.remaining < 1;

    const bumpQuantity = (delta: number) => {
        const next = Math.max(1, (Number(data.quantity) || 0) + delta);
        setData('quantity', maxQuantity ? Math.min(next, maxQuantity) : next);
    };

    const referenceItems: SearchSheetItem[] = references.map((r) => {
        // Cuantas operaciones de la referencia siguen teniendo unidades por producir.
        const byOp = r.productions_quantity_by_operation ?? {};
        const pendingOps =
            r.lot_total_quantity != null
                ? r.operations.filter((o) => Number(byOp[String(o.id)] ?? 0) < Number(r.lot_total_quantity)).length
                : null;

        return {
            id: r.id,
            title: `${r.code} · ${r.name}`,
            subtitle: [
                `${r.operations.length} ${r.operations.length === 1 ? 'operacion' : 'operaciones'}`,
                pendingOps != null ? `${pendingOps} pendientes` : null,
            ]
                .filter(Boolean)
                .join(' · '),
            keywords: r.code,
            leading: r.image ? (
                <img src={r.image} alt="" className="h-11 w-11 rounded-lg object-cover" style={{ border: '1px solid var(--emp-border)' }} />
            ) : (
                <span
                    className="flex h-11 w-11 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'var(--emp-field-alt)', color: 'var(--emp-subtle)' }}
                >
                    <ImageIcon size={18} />
                </span>
            ),
        };
    });

    /**
     * Solo las operaciones que aun tienen unidades por producir: una operacion se considera
     * completa cuando su produccion acumulada cubre el lote de la referencia. Se filtra aqui
     * (no en `availableOperations`) para que una operacion ya elegida siga resolviendo su
     * precio automatico aunque quede fuera de la lista.
     */
    const pendingOperations = availableOperations.filter((o) => {
        const lot = selectedReference?.lot_total_quantity;
        if (lot == null) {
            return true;
        }
        const registered = Number((selectedReference?.productions_quantity_by_operation ?? {})[String(o.id)] ?? 0);

        return registered < Number(lot);
    });

    const operationItems: SearchSheetItem[] = pendingOperations.map((o) => {
        const registered = Number((selectedReference?.productions_quantity_by_operation ?? {})[String(o.id)] ?? 0);
        const lot = selectedReference?.lot_total_quantity;
        const pending = lot != null ? Math.max(0, Number(lot) - registered) : null;

        return {
            id: o.id,
            title: o.name,
            subtitle: pending != null ? `faltan ${pending} · registradas ${registered}` : `registradas ${registered}`,
            trailing: <span style={{ color: 'var(--emp-text)' }}>{formatCurrency(o.pivot.price)}</span>,
        };
    });

    const allOperationsDone = availableOperations.length > 0 && pendingOperations.length === 0;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('productions.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setData((prev) => ({
                    ...prev,
                    // La referencia se mantiene seleccionada (cacheada) para agilizar registros seguidos.
                    operation_id: '',
                    quantity: 1,
                    unit_price: '',
                    notes: '',
                    date: new Date().toISOString().split('T')[0],
                    employee_id: lockedEmployeeId ?? prev.employee_id,
                }));
            },
        });
    };

    return (
        <div className="emp-form">
            <form id="production-register-form" onSubmit={submit} className="flex w-full max-w-[640px] flex-col gap-3.5">
                {isWorkerLocked ? (
                    <p className="emp-note">
                        Al guardar, el registro queda pendiente hasta que un administrador lo confirme para nómina.
                    </p>
                ) : null}

                {lockedEmployeeId && lockedEmployeeName ? (
                    <div
                        className="rounded-lg px-3 py-2.5 text-[13px]"
                        style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                    >
                        <span style={{ color: 'var(--emp-muted)' }}>Empleado: </span>
                        <span style={{ color: 'var(--emp-text)' }}>{lockedEmployeeName}</span>
                    </div>
                ) : (
                    <div className="min-w-0">
                        <label className="emp-label" htmlFor="production-employee">
                            Empleado <span className="emp-req">*</span>
                        </label>
                        <div className="relative">
                            <select
                                id="production-employee"
                                value={data.employee_id}
                                onChange={(e) => setData('employee_id', Number(e.target.value))}
                                required
                                className={`emp-field ${errors.employee_id ? 'emp-field-error' : ''}`}
                            >
                                <option value="">Selecciona empleado</option>
                                {employees.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.first_name} {e.last_name} ({e.document_number})
                                    </option>
                                ))}
                            </select>
                            <CaretDown
                                size={13}
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                                style={{ color: 'var(--emp-subtle)' }}
                            />
                        </div>
                        {errors.employee_id ? <p className="emp-error">{errors.employee_id}</p> : null}
                    </div>
                )}

                <PickerField
                    label="Referencia"
                    required
                    error={errors.reference_id}
                    placeholder="Buscar referencia…"
                    primary={selectedReference ? `${selectedReference.code} · ${selectedReference.name}` : undefined}
                    secondary={
                        selectedReference && lotCapInfo.cap != null
                            ? `Lote ${formatNumber(lotCapInfo.cap)}${
                                  lotCapInfo.remaining != null ? ` · disponibles ${formatNumber(lotCapInfo.remaining)}` : ''
                              }`
                            : undefined
                    }
                    leading={
                        selectedReference?.image ? (
                            <img
                                src={selectedReference.image}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                style={{ border: '1px solid var(--emp-border)' }}
                            />
                        ) : (
                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: 'var(--emp-accent-fill)', color: 'var(--emp-accent-line)' }}
                            >
                                <ImageIcon size={17} />
                            </span>
                        )
                    }
                    onOpen={() => setReferenceSheetOpen(true)}
                />

                <PickerField
                    label="Operación"
                    required
                    error={errors.operation_id}
                    disabled={!data.reference_id || allOperationsDone}
                    placeholder={
                        !data.reference_id
                            ? 'Primero elige referencia'
                            : allOperationsDone
                              ? 'Todas las operaciones completaron el lote'
                              : 'Buscar operación…'
                    }
                    primary={selectedOperation?.name}
                    secondary={selectedOperation ? `${formatCurrency(selectedOperation.pivot.price)} / und` : undefined}
                    onOpen={() => setOperationSheetOpen(true)}
                />

                {lotCapInfo.cap != null ? (
                    <p className="emp-note">
                        Tope del lote (por operación): <strong>{formatNumber(lotCapInfo.cap)}</strong> unidades.
                        {lotCapInfo.registeredThisOperation != null ? (
                            <>
                                {' '}
                                Esta operación: registradas <strong>{formatNumber(lotCapInfo.registeredThisOperation)}</strong> ·
                                disponibles <strong>{formatNumber(lotCapInfo.remaining ?? 0)}</strong>
                                {lotCapInfo.remaining === 0
                                    ? ' · no puedes registrar más producción para esta operación en esta referencia.'
                                    : ''}
                            </>
                        ) : (
                            <> Selecciona una operación para ver el saldo disponible.</>
                        )}
                    </p>
                ) : null}

                {/* Cantidad y turno en una fila; los pasos rapidos quedan debajo. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                        <div className="flex items-baseline justify-between">
                            <label className="emp-label" htmlFor="production-quantity">
                                Cantidad <span className="emp-req">*</span>
                            </label>
                            {maxQuantity ? (
                                <span className="text-[11px] tabular-nums" style={{ color: 'var(--emp-subtle)' }}>
                                    máx. {formatNumber(maxQuantity)}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => bumpQuantity(-1)}
                                disabled={lotClosed}
                                aria-label="Restar una unidad"
                                className="emp-btn shrink-0 px-0"
                                style={{ width: '44px' }}
                            >
                                <Minus size={15} />
                            </button>
                            <input
                                id="production-quantity"
                                type="number"
                                min={1}
                                max={maxQuantity}
                                value={data.quantity}
                                onChange={(e) => setData('quantity', Number(e.target.value))}
                                required
                                disabled={lotClosed}
                                className={`emp-field text-center tabular-nums ${errors.quantity ? 'emp-field-error' : ''}`}
                                style={{ fontSize: '16px' }}
                            />
                            <button
                                type="button"
                                onClick={() => bumpQuantity(1)}
                                disabled={lotClosed}
                                aria-label="Sumar una unidad"
                                className="emp-btn shrink-0 px-0"
                                style={{ width: '44px' }}
                            >
                                <Plus size={15} />
                            </button>
                        </div>
                        {errors.quantity ? <p className="emp-error">{errors.quantity}</p> : null}

                        <div className="mt-1.5 flex gap-1.5">
                            {[10, 50, 100].map((step) => (
                                <button
                                    key={step}
                                    type="button"
                                    onClick={() => bumpQuantity(step)}
                                    disabled={lotClosed}
                                    className="emp-btn emp-btn-sm flex-1"
                                >
                                    +{step}
                                </button>
                            ))}
                            {maxQuantity ? (
                                <button
                                    type="button"
                                    onClick={() => setData('quantity', maxQuantity)}
                                    disabled={lotClosed}
                                    className="emp-btn emp-btn-sm flex-1"
                                >
                                    Todo
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <span className="emp-label">
                            Turno <span className="emp-req">*</span>
                        </span>
                        <div className="emp-seg" role="radiogroup" aria-label="Turno">
                            {[
                                { value: 'manana', label: 'Mañana' },
                                { value: 'tarde', label: 'Tarde' },
                                { value: 'noche', label: 'Noche' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={data.shift === opt.value}
                                    onClick={() => setData('shift', opt.value)}
                                    className={`emp-seg-item ${data.shift === opt.value ? 'emp-seg-on' : ''}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {errors.shift ? <p className="emp-error">{errors.shift}</p> : null}

                        <div className="mt-3">
                            <label className="emp-label" htmlFor="production-date">
                                Fecha <span className="emp-req">*</span>
                            </label>
                            <input
                                id="production-date"
                                type="date"
                                value={data.date}
                                onChange={(e) => setData('date', e.target.value)}
                                required
                                max={new Date().toISOString().split('T')[0]}
                                className={`emp-field ${errors.date ? 'emp-field-error' : ''}`}
                            />
                            {errors.date ? <p className="emp-error">{errors.date}</p> : null}
                        </div>
                    </div>
                </div>

                {/* El precio lo fija la operacion; el administrador puede ajustarlo. */}
                {isWorkerLocked ? null : (
                    <div className="min-w-0">
                        <label className="emp-label" htmlFor="production-price">
                            Precio unitario
                        </label>
                        <div className="relative">
                            <span
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px]"
                                style={{ color: 'var(--emp-subtle)' }}
                            >
                                $
                            </span>
                            <input
                                id="production-price"
                                type="number"
                                step="0.01"
                                value={data.unit_price}
                                onChange={(e) => setData('unit_price', e.target.value)}
                                className={`emp-field pl-6 tabular-nums ${errors.unit_price ? 'emp-field-error' : ''}`}
                            />
                        </div>
                        <p className="emp-help">Se calcula con la operación elegida; ajústalo solo si aplica.</p>
                        {errors.unit_price ? <p className="emp-error">{errors.unit_price}</p> : null}
                    </div>
                )}

                <div className="min-w-0">
                    <label className="emp-label" htmlFor="production-notes">
                        Observaciones
                    </label>
                    <textarea
                        id="production-notes"
                        rows={3}
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        className={`emp-field ${errors.notes ? 'emp-field-error' : ''}`}
                    />
                    {errors.notes ? <p className="emp-error">{errors.notes}</p> : null}
                </div>
            </form>

            {/*
              * Resumen y accion.
              *
              * Es `sticky`, no `fixed`: al ocupar su lugar en el flujo flota sobre el borde
              * inferior mientras se llena el formulario y aterriza en el en cuanto se llega,
              * dejando ver lo que sigue en la pagina. Los margenes negativos cancelan el
              * relleno del contenedor para que llegue a los bordes de la pantalla.
              */}
            <div
                className="sticky bottom-0 z-30 -mx-4 mt-3.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-[34px] sm:px-[34px] lg:static lg:mx-0 lg:max-w-[640px] lg:px-0 lg:pb-0"
                style={{ backgroundColor: 'var(--emp-bar)', borderTop: '1px solid var(--emp-border)' }}
            >
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <p className="emp-kicker">Valor del registro</p>
                        <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: 'var(--emp-muted)' }}>
                            {formatNumber(data.quantity || 0)} und × {formatCurrency(data.unit_price || 0)}
                        </p>
                    </div>
                    <p className="shrink-0 text-[24px] leading-none tabular-nums" style={{ color: 'var(--emp-text)' }}>
                        {formatCurrency(total)}
                    </p>
                </div>

                <div className="mt-3 flex gap-2">
                    {cancelHref ? (
                        <a href={cancelHref} className="emp-btn shrink-0" style={{ width: '96px', color: 'var(--emp-muted)' }}>
                            Cancelar
                        </a>
                    ) : null}
                    <button
                        type="submit"
                        form="production-register-form"
                        disabled={processing || lotClosed}
                        className="emp-btn emp-btn-primary flex-1"
                    >
                        {processing ? 'Guardando…' : submitButtonText}
                    </button>
                </div>
            </div>

            <SearchSheet
                open={referenceSheetOpen}
                onClose={() => setReferenceSheetOpen(false)}
                title="Elegir referencia"
                items={referenceItems}
                selectedId={data.reference_id || null}
                recentIds={recentReferenceIds}
                searchPlaceholder="Codigo o nombre…"
                countLabel={(shown, total) => `${shown} de ${total} referencias activas`}
                onSelect={(id) => {
                    setData('reference_id', Number(id));
                    setData('operation_id', '');
                    setData('unit_price', '');
                    setRecentReferenceIds(pushRecentReferenceId(Number(id)));
                }}
            />
            <SearchSheet
                open={operationSheetOpen}
                onClose={() => setOperationSheetOpen(false)}
                title="Elegir operacion"
                subtitle={selectedReference ? `${selectedReference.code} ${selectedReference.name}` : undefined}
                items={operationItems}
                selectedId={data.operation_id || null}
                searchPlaceholder="Buscar operacion…"
                emptyMessage="No quedan operaciones con unidades pendientes en esta referencia."
                countLabel={(shown, total) => `${shown} de ${total} operaciones con unidades pendientes`}
                onSelect={(id) => setData('operation_id', Number(id))}
            />
        </div>
    );
}
