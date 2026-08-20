import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import { ReferenceUnitEconomicsCard } from '@/Components/References/ReferenceUnitEconomicsCard';
import { OperationQuickCreateModal, type QuickCreatedOperation } from '@/Components/Operations/OperationQuickCreateModal';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { formatCurrency } from '@/lib/utils';

interface OperationOption {
    id: number;
    name: string;
    base_price: string | number;
    estimated_minutes?: string | number;
}

interface RefOperation {
    operation_id: number;
    name: string;
    price: number;
    estimated_minutes: number;
}

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
    const [selectedOpId, setSelectedOpId] = useState<number | ''>('');
    const [opPrice, setOpPrice] = useState<string>('');
    const [opMinutes, setOpMinutes] = useState<string>('');
    const [showOperationModal, setShowOperationModal] = useState(false);

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
            operations: refOperations.map((o) => ({ operation_id: o.operation_id, price: o.price, estimated_minutes: o.estimated_minutes })),
        };
        router.post(route('references.store'), payload as never, { forceFormData: true });
    };

    /**
     * Enter no envia el formulario.
     *
     * La referencia se arma por partes — datos basicos y operaciones que se agregan de a
     * una —, asi que el envio implicito del navegador la creaba a medio llenar con solo
     * pulsar Enter en cualquier campo. Se guarda unicamente desde «Guardar».
     *
     * Se deja pasar en el textarea, donde Enter es un salto de linea, y sobre un boton
     * enfocado, que es pulsarlo: cortarlo ahi dejaria el formulario sin teclado.
     */
    const bloquearEnvioConEnter = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter') return;

        const destino = e.target as HTMLElement | null;
        if (destino?.tagName === 'TEXTAREA' || destino?.tagName === 'BUTTON') return;

        e.preventDefault();
    };

    const addOperation = () => {
        if (!selectedOpId) return;
        const op = availableOperations.find((o) => o.id === Number(selectedOpId));
        if (!op) return;
        if (refOperations.some((r) => r.operation_id === op.id)) return;

        setRefOperations((prev) => [
            ...prev,
            {
                operation_id: op.id,
                name: op.name,
                price: opPrice ? Number(opPrice) : Number(op.base_price),
                estimated_minutes: opMinutes ? Number(opMinutes) : Number(op.estimated_minutes ?? 0),
            },
        ]);
        setSelectedOpId('');
        setOpPrice('');
        setOpMinutes('');
    };

    const removeOp = (id: number) => setRefOperations((prev) => prev.filter((r) => r.operation_id !== id));

    const handleOperationCreated = (op: QuickCreatedOperation) => {
        setAvailableOperations((prev) => [...prev, op].sort((a, b) => a.name.localeCompare(b.name)));
        setRefOperations((prev) => [
            ...prev,
            { operation_id: op.id, name: op.name, price: Number(op.base_price), estimated_minutes: Number(op.estimated_minutes) },
        ]);
        setShowOperationModal(false);
    };

    return (
        <AppLayout title="Nueva referencia">
            <Head title="Nueva referencia" />
            <form onSubmit={submit} onKeyDown={bloquearEnvioConEnter} className="space-y-6">
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
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_160px_auto]">
                            <Select
                                label="Operacion"
                                value={selectedOpId}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    setSelectedOpId(id);
                                    const op = availableOperations.find((o) => o.id === id);
                                    if (op) {
                                        setOpPrice(String(op.base_price));
                                        setOpMinutes(String(op.estimated_minutes ?? ''));
                                    }
                                }}
                                options={availableOperations.filter((o) => !refOperations.some((r) => r.operation_id === o.id)).map((o) => ({
                                    value: o.id, label: `${o.name} (${formatCurrency(o.base_price)})`,
                                }))}
                                placeholder="Selecciona una operacion"
                            />
                            <Input label="Precio" type="number" step="0.01" value={opPrice} onChange={(e) => setOpPrice(e.target.value)} prefix="$" />
                            <Input
                                label="Minutos"
                                type="number"
                                step="0.1"
                                min={0.1}
                                value={opMinutes}
                                onChange={(e) => setOpMinutes(e.target.value)}
                                suffix="min"
                                description={
                                    opMinutes
                                        ? `Dificultad: ${difficultyLabel(levelFromMinutes(Number(opMinutes), thresholds))}`
                                        : 'Minutos de esta operacion para esta referencia'
                                }
                            />
                            <div className="flex items-end">
                                <Button type="button" onClick={addOperation} icon={<PlusIcon className="h-4 w-4" />} disabled={!selectedOpId}>
                                    Agregar
                                </Button>
                            </div>
                        </div>
                        <Can permission="operations.index.create">
                            <div className="mt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={<PlusIcon className="h-4 w-4" />}
                                    onClick={() => setShowOperationModal(true)}
                                >
                                    Nueva operacion
                                </Button>
                            </div>
                        </Can>

                        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="responsive-table w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-2">Operacion</th>
                                        <th className="px-4 py-2 text-right">Precio</th>
                                        <th className="px-4 py-2 text-right">Minutos</th>
                                        <th className="px-4 py-2 text-center">Dificultad</th>
                                        <th className="w-16" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {refOperations.length === 0 ? (
                                        <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aun no agregaste operaciones</td></tr>
                                    ) : (
                                        refOperations.map((r) => (
                                            <tr key={r.operation_id}>
                                                <td className="px-4 py-2" data-label="Operacion">{r.name}</td>
                                                <td className="px-4 py-2 text-right font-medium" data-label="Precio">{formatCurrency(r.price)}</td>
                                                <td className="px-4 py-2 text-right" data-label="Minutos">{r.estimated_minutes} min</td>
                                                <td className="px-4 py-2 text-center" data-label="Dificultad">
                                                    <Badge variant="info">{difficultyLabel(levelFromMinutes(r.estimated_minutes, thresholds))}</Badge>
                                                </td>
                                                <td className="px-4 py-2 text-right" data-label="">
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
                        operationalLotQty={lotQtyPreview > 0 ? lotQtyPreview : undefined}
                        totalOperational={lotQtyPreview > 0 ? totalOperationalPreview : undefined}
                    />
                </div>
            </form>

            <OperationQuickCreateModal
                open={showOperationModal}
                onClose={() => setShowOperationModal(false)}
                onCreated={handleOperationCreated}
            />
        </AppLayout>
    );
}
