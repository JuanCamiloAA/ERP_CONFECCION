import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
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

function readCachedReferenceId(): number | '' {
    if (typeof window === 'undefined') {
        return '';
    }
    const raw = window.localStorage.getItem(LAST_REFERENCE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : '';
}

interface ProductionRegisterFormProps {
    references: ReferenceWithOps[];
    employees?: Employee[];
    /** Si se define, el empleado queda fijo (usuario operario). */
    lockedEmployeeId?: number;
    lockedEmployeeName?: string;
    submitButtonText?: string;
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
        <form id="production-register-form" onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader
                    title="Registrar produccion"
                    description={
                        isWorkerLocked
                            ? 'Al guardar, el registro queda pendiente hasta que un administrador lo confirme para nomina.'
                            : 'Completa los datos del trabajo realizado.'
                    }
                />
                {selectedReference ? (
                    <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/40">
                        {selectedReference.image ? (
                            <img
                                src={selectedReference.image}
                                alt={selectedReference.name}
                                className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-600"
                            />
                        ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500">
                                <PhotoIcon className="h-8 w-8" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Referencia seleccionada</p>
                            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                                {selectedReference.code} - {selectedReference.name}
                            </p>
                            {!selectedReference.image ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Sin imagen registrada.</p>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {lockedEmployeeId && lockedEmployeeName ? (
                        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40">
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

                    <Select
                        label="Referencia"
                        value={data.reference_id}
                        onChange={(e) => {
                            setData('reference_id', Number(e.target.value));
                            setData('operation_id', '');
                            setData('unit_price', '');
                        }}
                        error={errors.reference_id}
                        options={references.map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }))}
                        placeholder="Selecciona referencia"
                        required
                    />
                    <Select
                        label="Operacion"
                        value={data.operation_id}
                        onChange={(e) => setData('operation_id', Number(e.target.value))}
                        error={errors.operation_id}
                        options={availableOperations.map((o) => ({
                            value: o.id,
                            label: `${o.name} (${formatCurrency(o.pivot.price)})`,
                        }))}
                        placeholder={data.reference_id ? 'Selecciona operacion' : 'Primero elige referencia'}
                        disabled={!data.reference_id}
                        required
                    />

                    {lotCapInfo.cap != null && (
                        <div
                            className={`sm:col-span-2 rounded-lg border px-3 py-2 text-sm ${
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

                    <Input
                        label="Cantidad"
                        type="number"
                        min={1}
                        max={lotCapInfo.remaining != null ? lotCapInfo.remaining || undefined : lotCapInfo.cap ?? undefined}
                        value={data.quantity}
                        onChange={(e) => setData('quantity', Number(e.target.value))}
                        error={errors.quantity}
                        required
                        disabled={lotCapInfo.remaining != null && lotCapInfo.remaining < 1}
                        description={
                            lotCapInfo.remaining != null && lotCapInfo.remaining > 0
                                ? `Maximo permitido para esta operacion: ${lotCapInfo.remaining} unidades.`
                                : undefined
                        }
                    />
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

                    <Select
                        label="Turno"
                        value={data.shift}
                        onChange={(e) => setData('shift', e.target.value)}
                        error={errors.shift}
                        options={[
                            { value: 'manana', label: 'Manana' },
                            { value: 'tarde', label: 'Tarde' },
                            { value: 'noche', label: 'Noche' },
                        ]}
                        required
                    />

                    <Textarea
                        label="Observaciones"
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        error={errors.notes}
                        className="sm:col-span-2"
                        rows={3}
                    />
                </div>
                <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
                    <Button type="submit" loading={processing} disabled={lotCapInfo.remaining != null && lotCapInfo.remaining < 1}>
                        {submitButtonText}
                    </Button>
                </div>
            </Card>

            <Card>
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
    );
}
