import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeftIcon, PencilSquareIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ReferenceUnitEconomicsCard } from '@/Components/References/ReferenceUnitEconomicsCard';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency } from '@/lib/utils';
import type { Reference, ReferenceEconomicsComparison, ReferenceOperationPivot } from '@/types';

interface OperationOption {
    id: number;
    name: string;
    base_price: string | number;
}

interface Props {
    reference: Reference & { operations: ReferenceOperationPivot[]; productions_sum_quantity?: number | null };
    allOperations: OperationOption[];
    comparison: ReferenceEconomicsComparison;
}

export default function ReferenceShow({ reference, allOperations, comparison }: Props) {
    const [selectedOpId, setSelectedOpId] = useState<number | ''>('');
    const [opPrice, setOpPrice] = useState<string>('');

    const attached = reference.operations ?? [];

    const handleAttach = () => {
        if (!selectedOpId) return;
        router.post(route('references.operations.attach', reference.id), {
            operation_id: selectedOpId,
            price: Number(opPrice || 0),
        }, {
            onSuccess: () => {
                setSelectedOpId('');
                setOpPrice('');
            },
        });
    };

    const handleDetach = (operationId: number) => {
        router.delete(route('references.operations.detach', [reference.id, operationId]));
    };

    return (
        <AppLayout title={reference.name}>
            <Head title={reference.name} />
            <div className="space-y-6">
                <PageHeader
                    title={`${reference.code} · ${reference.name}`}
                    breadcrumbs={[
                        { label: 'Referencias', href: route('references.index') },
                        { label: reference.code },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('references.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Volver</Button>
                            </Link>
                            <Link href={route('references.edit', reference.id)}>
                                <Button icon={<PencilSquareIcon className="h-4 w-4" />}>Editar</Button>
                            </Link>
                        </div>
                    }
                />

                <Card>
                    <div className="flex flex-col items-start gap-4 sm:flex-row">
                        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40">
                            {reference.image ? (
                                <img src={reference.image} alt={reference.name} className="h-24 w-24 rounded-lg object-cover" />
                            ) : (
                                <TagIcon className="h-10 w-10" />
                            )}
                        </div>
                        <div className="flex-1">
                            <Badge variant={reference.is_active ? 'success' : 'danger'}>{reference.is_active ? 'Activa' : 'Inactiva'}</Badge>
                            {reference.lot_total_quantity != null && (
                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                    Lote total: <strong>{reference.lot_total_quantity}</strong> unidades por operacion · Suma de todas las
                                    producciones: <strong>{Number(reference.productions_sum_quantity ?? 0)}</strong> (todas las operaciones).
                                </p>
                            )}
                            <p className="mt-2 text-base text-slate-700 dark:text-slate-300">{reference.description ?? 'Sin descripcion.'}</p>
                        </div>
                    </div>
                </Card>

                <ReferenceUnitEconomicsCard
                    paymentPerUnit={comparison.payment_per_unit}
                    productionCostPerUnit={comparison.production_cost_per_unit}
                    hasOperations={comparison.has_operations}
                    currency={comparison.currency}
                    paymentIncomplete={comparison.payment_per_unit_incomplete}
                    operationalLotQtyAtCostFix={comparison.operational_lot_qty_at_cost_fix}
                    totalOperationalAtCreation={comparison.total_operational_at_creation}
                />

                <Card>
                    <CardHeader title="Operaciones" description="Operaciones disponibles con su precio especifico" />
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto]">
                        <Select
                            label="Agregar operacion"
                            value={selectedOpId}
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                setSelectedOpId(id);
                                const op = allOperations.find((o) => o.id === id);
                                if (op) setOpPrice(String(op.base_price));
                            }}
                            options={allOperations.filter((o) => !attached.some((r) => r.id === o.id)).map((o) => ({
                                value: o.id,
                                label: `${o.name} (${formatCurrency(o.base_price)})`,
                            }))}
                            placeholder="Selecciona..."
                        />
                        <Input label="Precio" type="number" step="0.01" value={opPrice} onChange={(e) => setOpPrice(e.target.value)} prefix="$" />
                        <div className="flex items-end">
                            <Button onClick={handleAttach} icon={<PlusIcon className="h-4 w-4" />} disabled={!selectedOpId}>Agregar</Button>
                        </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-2">Operacion</th>
                                    <th className="px-4 py-2 text-right">Precio</th>
                                    <th className="px-4 py-2 text-center">Estado</th>
                                    <th className="w-16" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {attached.length === 0 ? (
                                    <tr><td colSpan={4} className="py-6 text-center text-slate-400">No hay operaciones asociadas</td></tr>
                                ) : (
                                    attached.map((op) => (
                                        <tr key={op.id}>
                                            <td className="px-4 py-2">{op.name}</td>
                                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(op.pivot.price)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <Badge variant={op.pivot.is_active ? 'success' : 'danger'}>{op.pivot.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <Button variant="ghost" size="sm" icon={<TrashIcon className="h-4 w-4 text-rose-500" />} onClick={() => handleDetach(op.id)} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
