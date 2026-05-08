import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { ReferenceUnitEconomicsCard } from '@/Components/References/ReferenceUnitEconomicsCard';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import type { Reference, ReferenceEconomicsComparison } from '@/types';

interface Props {
    reference: Reference;
    comparison: ReferenceEconomicsComparison;
}

export default function ReferenceEdit({ reference, comparison }: Props) {
    const { data, setData, processing, errors } = useForm({
        code: reference.code,
        name: reference.name,
        payment_per_unit:
            reference.payment_per_unit != null && reference.payment_per_unit !== ''
                ? String(reference.payment_per_unit)
                : '',
        description: reference.description ?? '',
        lot_total_quantity: (reference.lot_total_quantity ?? '') as number | '',
        image: null as File | null,
        is_active: reference.is_active,
    });

    const paymentNum = data.payment_per_unit === '' ? 0 : Number(data.payment_per_unit);
    const paymentIncompleteUi = comparison.payment_per_unit_incomplete && data.payment_per_unit === '';

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.post(route('references.update', reference.id), {
            ...data,
            _method: 'put',
        } as never, { forceFormData: true });
    };

    return (
        <AppLayout title="Editar referencia">
            <Head title={`Editar ${reference.code}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${reference.code}`}
                    breadcrumbs={[
                        { label: 'Referencias', href: route('references.index') },
                        { label: reference.code, href: route('references.show', reference.id) },
                        { label: 'Editar' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('references.show', reference.id)}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos basicos" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Codigo" value={data.code} onChange={(e) => setData('code', e.target.value)} error={errors.code} required />
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input
                            label="Valor unitario de pago"
                            type="number"
                            step="0.01"
                            min={0}
                            value={data.payment_per_unit}
                            onChange={(e) => setData('payment_per_unit', e.target.value)}
                            error={errors.payment_per_unit}
                            prefix="$"
                            description="Lo que reciben por cada unidad; distinto del costo interno en operaciones."
                        />
                        <Input
                            label="Cantidad total del lote"
                            type="number"
                            min={1}
                            value={data.lot_total_quantity}
                            onChange={(e) =>
                                setData('lot_total_quantity', e.target.value === '' ? ('' as number | '') : Number(e.target.value))}
                            error={errors.lot_total_quantity}
                            required
                            description="No puede ser menor a la suma de produccion ya registrada. El costo operacional fijo se calculo al crear con el lote en ese momento; cambiar este valor no actualiza ese costo."
                        />
                        <Textarea label="Descripcion" value={data.description} onChange={(e) => setData('description', e.target.value)} className="sm:col-span-2" rows={3} />
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Imagen</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setData('image', e.target.files?.[0] ?? null)}
                                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-medium file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activa" />
                        </div>
                    </div>
                </Card>

                <ReferenceUnitEconomicsCard
                    paymentPerUnit={paymentNum}
                    productionCostPerUnit={comparison.production_cost_per_unit}
                    hasOperations={comparison.has_operations}
                    currency={comparison.currency}
                    paymentIncomplete={paymentIncompleteUi}
                    operationalLotQtyAtCostFix={comparison.operational_lot_qty_at_cost_fix}
                    totalOperationalAtCreation={comparison.total_operational_at_creation}
                />
            </form>
        </AppLayout>
    );
}
