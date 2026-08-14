import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronUpDownIcon, MinusIcon, PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { SearchSheet, type SearchSheetItem } from '@/Components/UI/SearchSheet';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import { formatCurrency } from '@/lib/utils';
import type { Employee, ReferenceOperationPivot } from '@/types';

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
    leading?: React.ReactNode;
    onOpen: () => void;
}) {
    return (
        <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
                {required && <span className="ml-0.5 text-rose-500">*</span>}
            </label>
            <button
                type="button"
                onClick={onOpen}
                disabled={disabled}
                className={[
                    'flex min-h-14 w-full items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left transition-colors',
                    'border-slate-300 hover:border-indigo-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20',
                    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
                    'dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-900',
                    error ? 'border-rose-500' : '',
                ].join(' ')}
            >
                {leading}
                <span className="min-w-0 flex-1">
                    {primary ? (
                        <>
                            <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                                {primary}
                            </span>
                            {secondary && (
                                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{secondary}</span>
                            )}
                        </>
                    ) : (
                        <span className="text-[15px] text-slate-400 dark:text-slate-500">{placeholder}</span>
                    )}
                </span>
                <ChevronUpDownIcon className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
            {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
        </div>
    );
}

export function ProductionRegisterForm({
    references,
    employees = [],
    lockedEmployeeId,
    lockedEmployeeName,
    submitButtonText = 'Guardar registro',
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

    const selectedReference = useMemo(() => references.find((r) => r.id === Number(data.reference_id)), [data.reference_id, references]);
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
        const registered = Object.values(r.productions_quantity_by_operation ?? {}).reduce((m, v) => Math.max(m, Number(v)), 0);
        const remaining = r.lot_total_quantity != null ? Math.max(0, Number(r.lot_total_quantity) - registered) : null;
        return {
            id: r.id,
            title: `${r.code} · ${r.name}`,
            subtitle: [
                `${r.operations.length} ${r.operations.length === 1 ? 'operacion' : 'operaciones'}`,
                remaining != null ? `disponibles ${remaining}` : null,
            ]
                .filter(Boolean)
                .join(' · '),
            keywords: r.code,
            leading: r.image ? (
                <img src={r.image} alt="" className="h-11 w-11 rounded-lg border border-slate-200 object-cover dark:border-slate-600" />
            ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                    <PhotoIcon className="h-5 w-5" />
                </span>
            ),
        };
    });

    const operationItems: SearchSheetItem[] = availableOperations.map((o) => {
        const registered = Number((selectedReference?.productions_quantity_by_operation ?? {})[String(o.id)] ?? 0);
        return {
            id: o.id,
            title: o.name,
            subtitle: `registradas ${registered}`,
            trailing: <span className="text-slate-700 dark:text-slate-300">{formatCurrency(o.pivot.price)}</span>,
        };
    });

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
        <>
            <form id="production-register-form" onSubmit={submit} className="grid grid-cols-1 gap-6 pb-28 lg:grid-cols-3 lg:pb-0">
                <Card className="lg:col-span-2">
                    <CardHeader
                        title="Registrar produccion"
                        description={
                            isWorkerLocked
                                ? 'Al guardar, el registro queda pendiente hasta que un administrador lo confirme para nomina.'
                                : 'Completa los datos del trabajo realizado.'
                        }
                    />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PickerField
                            label="Referencia"
                            required
                            error={errors.reference_id}
                            placeholder="Buscar referencia…"
                            primary={selectedReference ? `${selectedReference.code} · ${selectedReference.name}` : undefined}
                            secondary={
                                selectedReference && lotCapInfo.cap != null
                                    ? `Lote ${lotCapInfo.cap}${lotCapInfo.remaining != null ? ` · disponibles ${lotCapInfo.remaining}` : ''}`
                                    : undefined
                            }
                            leading={
                                selectedReference?.image ? (
                                    <img
                                        src={selectedReference.image}
                                        alt=""
                                        className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-600"
                                    />
                                ) : (
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                        <PhotoIcon className="h-5 w-5" />
                                    </span>
                                )
                            }
                            onOpen={() => setReferenceSheetOpen(true)}
                        />
                        <PickerField
                            label="Operacion"
                            required
                            error={errors.operation_id}
                            disabled={!data.reference_id}
                            placeholder={data.reference_id ? 'Buscar operacion…' : 'Primero elige referencia'}
                            primary={selectedOperation?.name}
                            secondary={selectedOperation ? `${formatCurrency(selectedOperation.pivot.price)} / und` : undefined}
                            onOpen={() => setOperationSheetOpen(true)}
                        />

                        {lockedEmployeeId && lockedEmployeeName ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-600 dark:bg-slate-900/40">
                                <span className="font-medium text-slate-600 dark:text-slate-400">Empleado: </span>
                                <span className="text-slate-900 dark:text-slate-100">{lockedEmployeeName}</span>
                            </div>
                        ) : (
                            <Select
                                label="Empleado"
                                value={data.employee_id}
                                onChange={(e) => setData('employee_id', Number(e.target.value))}
                                error={errors.employee_id}
                                options={employees.map((e) => ({
                                    value: e.id,
                                    label: `${e.first_name} ${e.last_name} (${e.document_number})`,
                                }))}
                                placeholder="Selecciona empleado"
                                required
                            />
                        )}
                        <Input
                            label="Fecha"
                            type="date"
                            value={data.date}
                            onChange={(e) => setData('date', e.target.value)}
                            error={errors.date}
                            required
                            max={new Date().toISOString().split('T')[0]}
                        />

                        {lotCapInfo.cap != null && (
                            <div
                                className={`rounded-lg border px-3 py-2 text-sm sm:col-span-2 ${
                                    lotCapInfo.remaining === 0
                                        ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300'
                                }`}
                            >
                                Tope del lote (por operacion): <strong>{lotCapInfo.cap}</strong> unidades.
                                {lotCapInfo.registeredThisOperation != null ? (
                                    <>
                                        {' '}
                                        Esta operacion: registradas <strong>{lotCapInfo.registeredThisOperation}</strong> · Disponibles:{' '}
                                        <strong>{lotCapInfo.remaining}</strong>
                                        {lotCapInfo.remaining === 0 &&
                                            ' · No puedes registrar mas produccion para esta operacion en esta referencia.'}
                                    </>
                                ) : (
                                    <> Selecciona una operacion para ver el saldo disponible de esa operacion.</>
                                )}
                            </div>
                        )}

                        {/* Cantidad: stepper de 56px + atajos, pensado para uso en planta con guantes. */}
                        <div className="sm:col-span-2">
                            <div className="mb-1.5 flex items-baseline justify-between">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Cantidad<span className="ml-0.5 text-rose-500">*</span>
                                </label>
                                {maxQuantity && <span className="text-xs text-slate-500 dark:text-slate-400">max. {maxQuantity}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => bumpQuantity(-1)}
                                    disabled={lotClosed}
                                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                                    aria-label="Restar una unidad"
                                >
                                    <MinusIcon className="h-5 w-5" />
                                </button>
                                <Input
                                    type="number"
                                    min={1}
                                    max={maxQuantity}
                                    value={data.quantity}
                                    onChange={(e) => setData('quantity', Number(e.target.value))}
                                    error={errors.quantity}
                                    required
                                    disabled={lotClosed}
                                    className="h-14 text-center text-2xl font-bold"
                                    containerClassName="flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => bumpQuantity(1)}
                                    disabled={lotClosed}
                                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                                    aria-label="Sumar una unidad"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="mt-2 flex gap-2">
                                {[10, 50, 100].map((step) => (
                                    <button
                                        key={step}
                                        type="button"
                                        onClick={() => bumpQuantity(step)}
                                        disabled={lotClosed}
                                        className="h-10 flex-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                    >
                                        +{step}
                                    </button>
                                ))}
                                {maxQuantity && (
                                    <button
                                        type="button"
                                        onClick={() => setData('quantity', maxQuantity)}
                                        disabled={lotClosed}
                                        className="h-10 flex-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                    >
                                        Todo
                                    </button>
                                )}
                            </div>
                        </div>

                        <Input
                            label="Precio unitario"
                            type="number"
                            step="0.01"
                            value={data.unit_price}
                            onChange={(e) => setData('unit_price', e.target.value)}
                            error={errors.unit_price}
                            prefix="$"
                            disabled={isWorkerLocked}
                            description={
                                isWorkerLocked
                                    ? 'Valor fijado segun la operacion seleccionada (no editable).'
                                    : 'Auto-calculado segun la referencia; puedes ajustarlo si aplica.'
                            }
                        />

                        {/* Turno como control segmentado: tres opciones cortas, un toque. */}
                        <div className="w-full">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Turno<span className="ml-0.5 text-rose-500">*</span>
                            </label>
                            <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                                {[
                                    { value: 'manana', label: 'Manana' },
                                    { value: 'tarde', label: 'Tarde' },
                                    { value: 'noche', label: 'Noche' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setData('shift', opt.value)}
                                        className={`h-11 flex-1 text-[13px] transition-colors ${
                                            data.shift === opt.value
                                                ? 'bg-indigo-600 font-semibold text-white'
                                                : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {errors.shift && <p className="mt-1.5 text-xs text-rose-500">{errors.shift}</p>}
                        </div>

                        <Textarea
                            label="Observaciones"
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            error={errors.notes}
                            className="sm:col-span-2"
                            rows={3}
                        />
                    </div>
                    <div className="mt-6 hidden justify-end border-t border-slate-200 pt-4 lg:flex dark:border-slate-700">
                        <Button type="submit" loading={processing} disabled={lotClosed}>
                            {submitButtonText}
                        </Button>
                    </div>
                </Card>

                <Card className="hidden lg:block">
                    <CardHeader title="Resumen" />
                    <dl className="mt-4 space-y-3">
                        <div>
                            <dt className="text-xs uppercase text-slate-500">Cantidad</dt>
                            <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.quantity}</dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase text-slate-500">Precio unitario</dt>
                            <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(data.unit_price)}</dd>
                        </div>
                        <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/30">
                            <dt className="text-xs font-semibold uppercase text-indigo-700 dark:text-indigo-300">Valor a pagar</dt>
                            <dd className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(total)}</dd>
                        </div>
                    </dl>
                </Card>
            </form>

            {/* Barra inferior fija en movil: total vivo + accion primaria al alcance del pulgar. */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-5 pt-3.5 lg:hidden dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                        Valor a pagar
                    </span>
                    <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(total)}</span>
                </div>
                <Button
                    type="submit"
                    form="production-register-form"
                    loading={processing}
                    disabled={lotClosed}
                    fullWidth
                    className="h-13 min-h-[52px] text-base"
                >
                    {submitButtonText}
                </Button>
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
                countLabel={(shown, total) => `${shown} de ${total} operaciones de la referencia`}
                onSelect={(id) => setData('operation_id', Number(id))}
            />
        </>
    );
}
