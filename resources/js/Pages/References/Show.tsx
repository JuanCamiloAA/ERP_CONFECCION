import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ReferenceUnitEconomicsCard } from '@/Components/References/ReferenceUnitEconomicsCard';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';
import { formatCurrency } from '@/lib/utils';
import type { Reference, ReferenceEconomicsComparison, ReferenceOperationPivot } from '@/types';

interface OperationOption {
    id: number;
    name: string;
    base_price: string | number;
    estimated_minutes?: string | number;
}

interface Props {
    reference: Reference & { operations: ReferenceOperationPivot[]; productions_sum_quantity?: number | null };
    allOperations: OperationOption[];
    comparison: ReferenceEconomicsComparison;
}

/**
 * Minutos que rigen la linea: los suyos y, si no los tiene, los estandar de la operacion.
 * Cero es "sin medir", no un tiempo real, asi que se trata como ausencia de dato.
 */
function lineMinutes(op: ReferenceOperationPivot): number | null {
    const raw = op.pivot.estimated_minutes ?? op.estimated_minutes;
    const value = raw != null && raw !== '' ? Number(raw) : NaN;

    return Number.isFinite(value) && value > 0 ? value : null;
}

export default function ReferenceShow({ reference, allOperations, comparison }: Props) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;
    const [selectedOpId, setSelectedOpId] = useState<number | ''>('');
    const [opPrice, setOpPrice] = useState<string>('');
    const [opMinutes, setOpMinutes] = useState<string>('');

    // Linea en edicion: se actualiza en sitio, sin desasociar y volver a asociar la operacion.
    const [editing, setEditing] = useState<ReferenceOperationPivot | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');
    const [editMinutes, setEditMinutes] = useState<string>('');
    const [editActive, setEditActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmRecalc, setConfirmRecalc] = useState(false);

    const attached = reference.operations ?? [];

    const openEdit = (op: ReferenceOperationPivot) => {
        setEditing(op);
        setEditPrice(String(op.pivot.price ?? ''));
        setEditMinutes(op.pivot.estimated_minutes != null ? String(op.pivot.estimated_minutes) : '');
        setEditActive(Boolean(op.pivot.is_active));
    };

    const handleSaveLine = () => {
        if (!editing) return;
        setSaving(true);
        router.put(route('references.operations.update', [reference.id, editing.id]), {
            price: Number(editPrice || 0),
            estimated_minutes: editMinutes !== '' ? Number(editMinutes) : null,
            is_active: editActive,
        }, {
            preserveScroll: true,
            onSuccess: () => setEditing(null),
            onFinish: () => setSaving(false),
        });
    };

    const handleRecalculate = () => {
        router.post(route('references.operations.recalculate', reference.id), {}, {
            preserveScroll: true,
            onFinish: () => setConfirmRecalc(false),
        });
    };

    const handleAttach = () => {
        if (!selectedOpId) return;
        router.post(route('references.operations.attach', reference.id), {
            operation_id: selectedOpId,
            price: Number(opPrice || 0),
            estimated_minutes: opMinutes !== '' ? Number(opMinutes) : null,
        }, {
            onSuccess: () => {
                setSelectedOpId('');
                setOpPrice('');
                setOpMinutes('');
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
                    operationalLotQty={comparison.operational_lot_qty}
                    totalOperational={comparison.total_operational}
                />

                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <CardHeader title="Operaciones" description="Operaciones disponibles con su precio especifico" />
                        <Button
                            variant="outline"
                            className="min-h-11 shrink-0"
                            icon={<ArrowPathIcon className="h-4 w-4" />}
                            onClick={() => setConfirmRecalc(true)}
                            disabled={attached.length === 0}
                        >
                            Recalcular dificultades
                        </Button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_160px_auto]">
                        <Select
                            label="Agregar operacion"
                            value={selectedOpId}
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                setSelectedOpId(id);
                                const op = allOperations.find((o) => o.id === id);
                                if (op) {
                                    setOpPrice(String(op.base_price));
                                    setOpMinutes(String(op.estimated_minutes ?? ''));
                                }
                            }}
                            options={allOperations.filter((o) => !attached.some((r) => r.id === o.id)).map((o) => ({
                                value: o.id,
                                label: `${o.name} (${formatCurrency(o.base_price)})`,
                            }))}
                            placeholder="Selecciona..."
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
                                opMinutes ? `Dificultad: ${difficultyLabel(levelFromMinutes(Number(opMinutes), thresholds))}` : undefined
                            }
                        />
                        <div className="flex items-end">
                            <Button onClick={handleAttach} icon={<PlusIcon className="h-4 w-4" />} disabled={!selectedOpId}>Agregar</Button>
                        </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="responsive-table w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-2">Operacion</th>
                                    <th className="px-4 py-2 text-right">Precio</th>
                                    <th className="px-4 py-2 text-right">Minutos</th>
                                    <th className="px-4 py-2 text-center">Dificultad</th>
                                    <th className="px-4 py-2 text-center">Estado</th>
                                    <th className="w-16" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {attached.length === 0 ? (
                                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">No hay operaciones asociadas</td></tr>
                                ) : (
                                    attached.map((op) => (
                                        <tr key={op.id}>
                                            <td className="px-4 py-2" data-label="Operacion">{op.name}</td>
                                            <td className="px-4 py-2 text-right font-medium" data-label="Precio">{formatCurrency(op.pivot.price)}</td>
                                            <td className="px-4 py-2 text-right" data-label="Minutos">
                                                {lineMinutes(op) !== null ? `${lineMinutes(op)} min` : '—'}
                                            </td>
                                            <td className="px-4 py-2 text-center" data-label="Dificultad">
                                                {op.pivot.difficulty_level ? (
                                                    <Badge variant="info">{difficultyLabel(op.pivot.difficulty_level)}</Badge>
                                                ) : (
                                                    <Badge variant="neutral">Sin medir</Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center" data-label="Estado">
                                                <Badge variant={op.pivot.is_active ? 'success' : 'danger'}>{op.pivot.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                            </td>
                                            <td className="px-4 py-2 text-right" data-label="">
                                                <div className="flex items-center justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="min-h-11 min-w-11"
                                                        icon={<PencilSquareIcon className="h-4 w-4" />}
                                                        onClick={() => openEdit(op)}
                                                        aria-label={`Editar ${op.name}`}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="min-h-11 min-w-11"
                                                        icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                        onClick={() => handleDetach(op.id)}
                                                        aria-label={`Quitar ${op.name}`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <Modal
                open={!!editing}
                onClose={() => setEditing(null)}
                title={editing ? `Editar ${editing.name}` : ''}
                description="Cambia el precio, los minutos o el estado de la linea sin quitarla de la referencia."
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" className="min-h-11" onClick={() => setEditing(null)}>Cancelar</Button>
                        <Button className="min-h-11" onClick={handleSaveLine} disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Precio"
                        type="number"
                        step="0.01"
                        min={0}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        prefix="$"
                    />
                    <Input
                        label="Minutos"
                        type="number"
                        step="0.1"
                        min={0.1}
                        value={editMinutes}
                        onChange={(e) => setEditMinutes(e.target.value)}
                        suffix="min"
                        description={
                            editMinutes && Number(editMinutes) > 0
                                ? `Dificultad: ${difficultyLabel(levelFromMinutes(Number(editMinutes), thresholds))}`
                                : 'Sin minutos la linea queda sin grado de dificultad.'
                        }
                    />
                    <Switch
                        checked={editActive}
                        onChange={setEditActive}
                        label="Linea activa"
                        description="Una linea inactiva deja de ofrecerse al registrar produccion."
                    />
                </div>
            </Modal>

            <ConfirmDialog
                open={confirmRecalc}
                onClose={() => setConfirmRecalc(false)}
                onConfirm={handleRecalculate}
                title="Recalcular dificultades"
                message="Se vuelve a calcular el grado de cada linea con los rangos de Mi empresa > Dificultad por minutos. Los precios y los minutos no cambian."
                confirmText="Recalcular"
            />
        </AppLayout>
    );
}
