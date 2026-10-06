import { Head, router, useForm } from '@inertiajs/react';
import { ArrowPathIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { EmptyState } from '@/Components/UI/EmptyState';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';

interface CycleRow {
    id: number;
    name: string;
    code: string;
    months: number;
    discount_percent: number;
    is_active: boolean;
    sort_order: number;
    companies_count: number;
}

interface Props {
    cycles: CycleRow[];
}

type FormFields = {
    name: string;
    code: string;
    months: string;
    discount_percent: string;
    is_active: boolean;
    sort_order: string;
};

const EMPTY: FormFields = { name: '', code: '', months: '1', discount_percent: '0', is_active: true, sort_order: '0' };

function monthsLabel(months: number): string {
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

/**
 * Periodos de cobro de la membresía (mensual, trimestral...).
 *
 * Cada plan guarda solo su precio mensual; el de cada periodo sale de multiplicarlo por los
 * meses y aplicar el descuento de aquí. Los periodos no se borran: se desactivan, y las
 * empresas que ya tienen uno inactivo lo conservan.
 */
export default function BillingCyclesIndex({ cycles }: Props) {
    const [editing, setEditing] = useState<CycleRow | null>(null);
    const [open, setOpen] = useState(false);

    const { data, setData, post, put, transform, processing, errors, reset, clearErrors } = useForm<FormFields>(EMPTY);

    const openCreate = () => {
        setEditing(null);
        reset();
        clearErrors();
        setData({ ...EMPTY, sort_order: String(cycles.length) });
        setOpen(true);
    };

    const openEdit = (cycle: CycleRow) => {
        setEditing(cycle);
        clearErrors();
        setData({
            name: cycle.name,
            code: cycle.code,
            months: String(cycle.months),
            discount_percent: String(cycle.discount_percent),
            is_active: cycle.is_active,
            sort_order: String(cycle.sort_order),
        });
        setOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        transform((d) => ({
            name: d.name,
            code: d.code,
            months: Number(d.months) || 0,
            discount_percent: Number(d.discount_percent) || 0,
            is_active: d.is_active,
            sort_order: Number(d.sort_order) || 0,
        }));

        const options = { preserveScroll: true, onSuccess: () => setOpen(false) };

        if (editing) {
            put(route('super-admin.billing-cycles.update', editing.id), options);

            return;
        }

        post(route('super-admin.billing-cycles.store'), options);
    };

    const toggle = (cycle: CycleRow) => {
        router.post(route('super-admin.billing-cycles.toggle', cycle.id), {}, { preserveScroll: true });
    };

    return (
        <AppLayout title="Periodos de cobro">
            <Head title="Periodos de cobro" />

            <div className="space-y-6">
                <PageHeader
                    title="Periodos de cobro"
                    description="Cada cuánto paga una empresa su membresía y con qué descuento. El precio de cada periodo sale del precio mensual del plan."
                    action={
                        <Button icon={<PlusIcon className="h-4 w-4" />} onClick={openCreate} className="whitespace-nowrap shrink-0">
                            Nuevo periodo
                        </Button>
                    }
                />

                {cycles.length === 0 ? (
                    <EmptyState
                        icon={<ArrowPathIcon className="h-8 w-8" />}
                        title="No hay periodos"
                        description="Crea al menos uno: sin periodos nadie puede renovar."
                        action={<Button onClick={openCreate}>Nuevo periodo</Button>}
                    />
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Periodo</TableHeader>
                                <TableHeader align="right">Duración</TableHeader>
                                <TableHeader align="right">Descuento</TableHeader>
                                <TableHeader align="right">Empresas</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {cycles.map((cycle) => (
                                <TableRow key={cycle.id}>
                                    <TableCell>
                                        <div className="text-[14px] text-[color:var(--emp-text)]">{cycle.name}</div>
                                        <div className="font-mono text-[12px] text-[color:var(--emp-muted)]">{cycle.code}</div>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">{monthsLabel(cycle.months)}</span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">
                                            {cycle.discount_percent > 0 ? `${cycle.discount_percent} %` : '—'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">{cycle.companies_count}</span>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Badge variant={cycle.is_active ? 'success' : 'neutral'}>
                                            {cycle.is_active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<PencilSquareIcon className="h-4 w-4" />}
                                                onClick={() => openEdit(cycle)}
                                                aria-label={`Editar ${cycle.name}`}
                                            />
                                            <Button variant="ghost" size="sm" onClick={() => toggle(cycle)}>
                                                {cycle.is_active ? 'Desactivar' : 'Activar'}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? `Editar ${editing.name}` : 'Nuevo periodo'}
                description="El descuento se aplica sobre el precio mensual por los meses del periodo, redondeado al siguiente mil."
                footer={
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="billing-cycle-form" disabled={processing}>
                            {editing ? 'Guardar' : 'Crear periodo'}
                        </Button>
                    </div>
                }
            >
                <form id="billing-cycle-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Nombre"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={errors.name}
                        required
                    />
                    <Input
                        label="Código"
                        value={data.code}
                        onChange={(e) => setData('code', e.target.value)}
                        error={errors.code}
                        description="Vacío = se arma con el nombre"
                    />
                    <Input
                        type="number"
                        min={1}
                        max={36}
                        label="Meses"
                        value={data.months}
                        onChange={(e) => setData('months', e.target.value)}
                        error={errors.months}
                        required
                    />
                    <Input
                        type="number"
                        min={0}
                        max={90}
                        label="Descuento (%)"
                        value={data.discount_percent}
                        onChange={(e) => setData('discount_percent', e.target.value)}
                        error={errors.discount_percent}
                    />
                    <Input
                        type="number"
                        min={0}
                        label="Orden"
                        value={data.sort_order}
                        onChange={(e) => setData('sort_order', e.target.value)}
                        error={errors.sort_order}
                        description="Menor primero"
                    />
                    <div className="flex items-end">
                        <Switch
                            checked={data.is_active}
                            onChange={(v) => setData('is_active', v)}
                            label="Activo"
                            description={errors.is_active ?? 'Los inactivos no se ofrecen al asignar'}
                        />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
