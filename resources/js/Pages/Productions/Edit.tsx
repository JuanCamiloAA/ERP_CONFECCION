import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from '@phosphor-icons/react';
import { FormEvent, useEffect, useMemo } from 'react';
import { StatusMark } from '@/Components/Productions/ProductionTable';
import { EmpInput, EmpSelect, EmpTextarea } from '@/Components/UI/ModuleFields';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Employee, Production, ReferenceOperationPivot } from '@/types';
import '../../../css/module-ui.css';

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

    // Lo que ya entro en una nomina pagada esta cerrado: el servidor rechaza el cambio,
    // asi que aqui se avisa antes en vez de dejar intentarlo.
    const isPaid = production.status === 'pagado';

    const selectedReference = useMemo(
        () => references.find((r) => r.id === Number(data.reference_id)),
        [data.reference_id, references],
    );
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
        <AppLayout title="Editar producción">
            <Head title="Editar producción" />

            <form onSubmit={submit} className="emp-form emp-bleed min-h-screen">
                <header
                    className="sticky top-0 z-30 px-4 py-3 sm:px-[34px] sm:py-4"
                    style={{ backgroundColor: 'var(--emp-bar)', borderBottom: '1px solid var(--emp-border)' }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link href={route('productions.index')} className="emp-btn emp-btn-ghost shrink-0 px-2">
                                <ArrowLeft size={17} />
                                <span className="max-sm:sr-only">Volver</span>
                            </Link>
                            <div className="min-w-0">
                                <nav
                                    className="hidden items-center gap-1.5 text-[12px] sm:flex"
                                    style={{ color: 'var(--emp-subtle)' }}
                                >
                                    <Link href={route('productions.index')} className="hover:underline">
                                        Producción
                                    </Link>
                                    <span>/</span>
                                    <span>Editar</span>
                                </nav>
                                <h1 className="truncate text-[17px] sm:mt-0.5 sm:text-[19px]" style={{ color: 'var(--emp-text)' }}>
                                    Editar registro
                                </h1>
                            </div>
                        </div>

                        <button type="submit" disabled={processing} className="emp-btn emp-btn-primary shrink-0">
                            {processing ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </header>

                <div className="px-4 pb-8 pt-5 sm:px-[34px] sm:pt-6">
                    <div className="emp-card w-full max-w-[720px] p-[17px]">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <EmpSelect
                                label="Empleado"
                                required
                                value={data.employee_id}
                                onChange={(e) => setData('employee_id', Number(e.target.value))}
                                error={errors.employee_id}
                                options={employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                            />
                            <EmpInput
                                label="Fecha"
                                type="date"
                                required
                                value={data.date}
                                onChange={(e) => setData('date', e.target.value)}
                                error={errors.date}
                                max={new Date().toISOString().split('T')[0]}
                            />
                            <EmpSelect
                                label="Referencia"
                                required
                                value={data.reference_id}
                                onChange={(e) => setData('reference_id', Number(e.target.value))}
                                error={errors.reference_id}
                                options={references.map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }))}
                            />
                            <EmpSelect
                                label="Operación"
                                required
                                value={data.operation_id}
                                onChange={(e) => setData('operation_id', Number(e.target.value))}
                                error={errors.operation_id}
                                options={availableOperations.map((o) => ({
                                    value: o.id,
                                    label: `${o.name} (${formatCurrency(o.pivot.price)})`,
                                }))}
                            />

                            {selectedReference?.lot_total_quantity != null ? (
                                <p className="emp-note sm:col-span-2">
                                    Tope del lote por operación:{' '}
                                    <strong>{formatNumber(selectedReference.lot_total_quantity)}</strong> · en este
                                    movimiento puedes dejar hasta{' '}
                                    <strong>{lotMaxQuantity != null ? formatNumber(lotMaxQuantity) : '—'}</strong> unidades.
                                    {lotMaxQuantity === 0 ? ' No hay saldo disponible para esta operación.' : ''}
                                </p>
                            ) : null}

                            <EmpInput
                                label="Cantidad"
                                type="number"
                                min={1}
                                max={lotMaxQuantity != null ? lotMaxQuantity || undefined : undefined}
                                required
                                value={data.quantity}
                                onChange={(e) => setData('quantity', Number(e.target.value))}
                                error={errors.quantity}
                                disabled={lotMaxQuantity != null && lotMaxQuantity < 1}
                                help={
                                    lotMaxQuantity != null && lotMaxQuantity > 0
                                        ? `Máximo para esta operación: ${formatNumber(lotMaxQuantity)} unidades.`
                                        : undefined
                                }
                            />
                            <EmpInput
                                label="Precio unitario"
                                type="number"
                                step="0.01"
                                prefix="$"
                                value={data.unit_price}
                                onChange={(e) => setData('unit_price', e.target.value)}
                                error={errors.unit_price}
                                disabled={priceLocked}
                                help={priceLocked ? 'Valor fijado según la operación (no editable).' : undefined}
                            />
                            <EmpSelect
                                label="Turno"
                                required
                                value={data.shift}
                                onChange={(e) => setData('shift', e.target.value as 'manana' | 'tarde' | 'noche')}
                                error={errors.shift}
                                options={[
                                    { value: 'manana', label: 'Mañana' },
                                    { value: 'tarde', label: 'Tarde' },
                                    { value: 'noche', label: 'Noche' },
                                ]}
                            />

                            {statusEditable && !isPaid ? (
                                <EmpSelect
                                    label="Estado del registro"
                                    required
                                    value={data.status}
                                    onChange={(e) => setData('status', e.target.value as 'pendiente' | 'confirmado')}
                                    error={errors.status}
                                    options={[
                                        { value: 'pendiente', label: 'Pendiente de confirmar' },
                                        { value: 'confirmado', label: 'Confirmado (cuenta para nómina)' },
                                    ]}
                                />
                            ) : (
                                <div className="min-w-0">
                                    <span className="emp-label">Estado</span>
                                    <div
                                        className="rounded-lg px-3 py-2.5"
                                        style={{ border: '1px solid var(--emp-border)', backgroundColor: 'var(--emp-field-alt)' }}
                                    >
                                        <StatusMark status={isPaid ? 'pagado' : data.status} />
                                        {isPaid ? (
                                            <p className="emp-help">
                                                Ya se liquidó en una nómina cerrada; el registro no se puede modificar.
                                            </p>
                                        ) : null}
                                        {!isPaid && data.status === 'pendiente' ? (
                                            <p className="emp-help">
                                                Un administrador debe confirmarlo para que cuente en la nómina.
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            <EmpTextarea
                                label="Observaciones"
                                rows={3}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                error={errors.notes}
                                containerClassName="sm:col-span-2"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
