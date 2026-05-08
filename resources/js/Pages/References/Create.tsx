import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { ReferenceUnitEconomicsCard } from '@/Components/References/ReferenceUnitEconomicsCard';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency } from '@/lib/utils';

interface OperationOption {
    id: number;
    name: string;
    base_price: string | number;
}

interface RefOperation {
    operation_id: number;
    name: string;
    price: number;
}

interface Props {
    operations: OperationOption[];
}

export default function ReferenceCreate({ operations }: Props) {
    const page = usePage<App.PageProps>();
    const settings = page.props.activeCompany?.settings as Record<string, unknown> | null | undefined;
    const companyCurrency = typeof settings?.currency === 'string' ? settings.currency : 'COP';
    const [refOperations, setRefOperations] = useState<RefOperation[]>([]);
    const [selectedOpId, setSelectedOpId] = useState<number | ''>('');
    const [opPrice, setOpPrice] = useState<string>('');

    const { data, setData, processing, errors } = useForm({
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
    const lotQtyPreview = data.lot_total_quantity === '' ? 0 : Number(data.lot_total_quantity);
    const totalOperationalPreview = Math.round(productionCostUnit * lotQtyPreview * 100) / 100;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const payload = {
            ...data,
            operations: refOperations.map((o) => ({ operation_id: o.operation_id, price: o.price })),
        };
        router.post(route('references.store'), payload as never, { forceFormData: true });
    };

    const addOperation = () => {
        if (!selectedOpId) return;
        const op = operations.find((o) => o.id === Number(selectedOpId));
        if (!op) return;
        if (refOperations.some((r) => r.operation_id === op.id)) return;

        setRefOperations((prev) => [
            ...prev,
            { operation_id: op.id, name: op.name, price: opPrice ? Number(opPrice) : Number(op.base_price) },
        ]);
        setSelectedOpId('');
        setOpPrice('');
    };

    const removeOp = (id: number) => setRefOperations((prev) => prev.filter((r) => r.operation_id !== id));

    return (
        <AppLayout title="Nueva referencia">
            <Head title="Nueva referencia" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva referencia"
                    breadcrumbs={[
                        { label: 'Referencias', href: route('references.index') },
                        { label: 'Nueva' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('references.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
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
                                onChange={(e) =>
                                    setData('payment_per_unit', e.target.value === '' ? ('' as number | '') : Number(e.target.value))}
                                error={errors.payment_per_unit}
                                required
                                prefix="$"
                                description="Lo que reciben por cada unidad vendida o entregada al cliente; no es el costo interno de operaciones."
                                className="sm:col-span-2"
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
                                description="Tope de unidades por operacion. Al guardar se fijara el costo operacional: suma de precios de operaciones x este lote."
                            />
                            <Textarea label="Descripcion" value={data.description} onChange={(e) => setData('description', e.target.value)} error={errors.description} className="sm:col-span-2" rows={3} />
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Imagen</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setData('image', e.target.files?.[0] ?? null)}
                                    className="w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activa" description="Disponible para registrar produccion" />
                            </div>
                        </div>
                    </Card>

                    <Card className="lg:col-span-3">
                        <CardHeader title="Operaciones de la referencia" description="Lista de operaciones con sus precios especificos" />
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto]">
                            <Select
                                label="Operacion"
                                value={selectedOpId}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    setSelectedOpId(id);
                                    const op = operations.find((o) => o.id === id);
                                    if (op) setOpPrice(String(op.base_price));
                                }}
                                options={operations.filter((o) => !refOperations.some((r) => r.operation_id === o.id)).map((o) => ({
                                    value: o.id, label: `${o.name} (${formatCurrency(o.base_price)})`,
                                }))}
                                placeholder="Selecciona una operacion"
                            />
                            <Input label="Precio" type="number" step="0.01" value={opPrice} onChange={(e) => setOpPrice(e.target.value)} prefix="$" />
                            <div className="flex items-end">
                                <Button type="button" onClick={addOperation} icon={<PlusIcon className="h-4 w-4" />} disabled={!selectedOpId}>
                                    Agregar
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-2">Operacion</th>
                                        <th className="px-4 py-2 text-right">Precio</th>
                                        <th className="w-16" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {refOperations.length === 0 ? (
                                        <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aun no agregaste operaciones</td></tr>
                                    ) : (
                                        refOperations.map((r) => (
                                            <tr key={r.operation_id}>
                                                <td className="px-4 py-2">{r.name}</td>
                                                <td className="px-4 py-2 text-right font-medium">{formatCurrency(r.price)}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <Button type="button" variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => removeOp(r.operation_id)} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <ReferenceUnitEconomicsCard
                        className="lg:col-span-3"
                        paymentPerUnit={paymentNum}
                        productionCostPerUnit={productionCostUnit}
                        hasOperations={refOperations.length > 0}
                        currency={companyCurrency}
                        operationalLotQtyAtCostFix={lotQtyPreview > 0 ? lotQtyPreview : undefined}
                        totalOperationalAtCreation={lotQtyPreview > 0 ? totalOperationalPreview : undefined}
                    />
                </div>
            </form>
        </AppLayout>
    );
}
