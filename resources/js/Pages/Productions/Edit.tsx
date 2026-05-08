import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent, useEffect, useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Badge } from '@/Components/UI/Badge';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency } from '@/lib/utils';
import type { Employee, Production, ReferenceOperationPivot } from '@/types';

interface ReferenceWithOps {
    id: number;
    code: string;
    name: string;
    lot_total_quantity?: number | null;
    productions_sum_quantity?: number | null;
    productions_quantity_by_operation?: Record<string, number>;
    operations: ReferenceOperationPivot[];
}

interface Props {
    production: Production;
    employees: Employee[];
    references: ReferenceWithOps[];
    priceLocked?: boolean;
    statusEditable?: boolean;
}

export default function ProductionEdit({ production, employees, references, priceLocked = false, statusEditable = false }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        employee_id: production.employee_id,
        reference_id: production.reference_id,
        operation_id: production.operation_id,
        quantity: production.quantity,
        unit_price: String(production.unit_price ?? ''),
        date: production.date,
        shift: production.shift,
        status: production.status ?? 'confirmado',
        notes: production.notes ?? '',
    });

    const selectedReference = useMemo(() => references.find((r) => r.id === Number(data.reference_id)), [data.reference_id, references]);
    const availableOperations = selectedReference?.operations ?? [];

    const lotMaxQuantity = useMemo(() => {
        const ref = selectedReference;
        if (!ref || ref.lot_total_quantity == null) return null;
        const opId = Number(data.operation_id);
        if (!opId) return null;
        const map = ref.productions_quantity_by_operation ?? {};
        const sumForOp = Number(map[String(opId)] ?? 0);
        const sameLine =
            Number(data.reference_id) === production.reference_id && Number(data.operation_id) === production.operation_id;
        const usedExcludingThisRow = sameLine ? sumForOp - production.quantity : sumForOp;
        return Math.max(0, ref.lot_total_quantity - usedExcludingThisRow);
    }, [
        selectedReference,
        data.reference_id,
        data.operation_id,
        production.reference_id,
        production.operation_id,
        production.quantity,
    ]);

    useEffect(() => {
        if (lotMaxQuantity != null && lotMaxQuantity > 0 && data.quantity > lotMaxQuantity) {
            setData('quantity', lotMaxQuantity);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedReference?.id, data.operation_id, lotMaxQuantity]);

    useEffect(() => {
        if (!priceLocked || !data.operation_id || availableOperations.length === 0) return;
        const op = availableOperations.find((o) => o.id === Number(data.operation_id));
        if (op) setData('unit_price', String(op.pivot.price));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.operation_id, data.reference_id, priceLocked]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('productions.update', production.id));
    };

    return (
        <AppLayout title="Editar produccion">
            <Head title="Editar produccion" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Editar produccion"
                    breadcrumbs={[
                        { label: 'Produccion', href: route('productions.index') },
                        { label: 'Editar' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('productions.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select label="Empleado" value={data.employee_id} onChange={(e) => setData('employee_id', Number(e.target.value))} options={employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))} required />
                        <Input label="Fecha" type="date" value={data.date} onChange={(e) => setData('date', e.target.value)} error={errors.date} required max={new Date().toISOString().split('T')[0]} />
                        <Select label="Referencia" value={data.reference_id} onChange={(e) => setData('reference_id', Number(e.target.value))} options={references.map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }))} required />
                        <Select label="Operacion" value={data.operation_id} onChange={(e) => setData('operation_id', Number(e.target.value))} options={availableOperations.map((o) => ({ value: o.id, label: `${o.name} (${formatCurrency(o.pivot.price)})` }))} required />
                        {selectedReference?.lot_total_quantity != null && (
                            <p className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                                Tope del lote por operacion: <strong>{selectedReference.lot_total_quantity}</strong> · Puedes dejar en este
                                movimiento hasta <strong>{lotMaxQuantity ?? '—'}</strong> unidades para la operacion seleccionada.
                                {lotMaxQuantity === 0 && ' No hay saldo disponible para esta operacion.'}
                            </p>
                        )}
                        <Input
                            label="Cantidad"
                            type="number"
                            min={1}
                            max={lotMaxQuantity != null ? lotMaxQuantity || undefined : undefined}
                            value={data.quantity}
                            onChange={(e) => setData('quantity', Number(e.target.value))}
                            error={errors.quantity}
                            required
                            disabled={lotMaxQuantity != null && lotMaxQuantity < 1}
                            description={
                                lotMaxQuantity != null && lotMaxQuantity > 0
                                    ? `Maximo permitido para esta operacion: ${lotMaxQuantity} unidades (tope del lote).`
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
                            disabled={priceLocked}
                            description={
                                priceLocked
                                    ? 'Valor fijado segun la operacion (no editable).'
                                    : undefined
                            }
                        />
                        <Select label="Turno" value={data.shift} onChange={(e) => setData('shift', e.target.value as 'manana' | 'tarde' | 'noche')} options={[{ value: 'manana', label: 'Manana' }, { value: 'tarde', label: 'Tarde' }, { value: 'noche', label: 'Noche' }]} required />
                        {statusEditable ? (
                            <Select
                                label="Estado del registro"
                                value={data.status}
                                onChange={(e) => setData('status', e.target.value as 'pendiente' | 'confirmado')}
                                error={errors.status}
                                options={[
                                    { value: 'pendiente', label: 'Pendiente de confirmar' },
                                    { value: 'confirmado', label: 'Confirmado (cuenta para nomina)' },
                                ]}
                                required
                            />
                        ) : (
                            <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40">
                                <span className="font-medium text-slate-600 dark:text-slate-400">Estado</span>
                                <div>
                                    <Badge variant={data.status === 'pendiente' ? 'warning' : 'success'}>
                                        {data.status === 'pendiente' ? 'Pendiente' : 'Confirmado'}
                                    </Badge>
                                    {data.status === 'pendiente' && (
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Un administrador debe confirmar el registro para que cuente en la nomina.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <Textarea label="Observaciones" value={data.notes} onChange={(e) => setData('notes', e.target.value)} className="sm:col-span-2" rows={3} />
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
