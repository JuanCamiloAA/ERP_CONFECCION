import { Head, router } from '@inertiajs/react';
import { ArrowPathIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate } from '@/lib/utils';

interface HolidayRow {
    id: number;
    country_code: string;
    date: string;
    name: string;
    is_emiliani_shifted: boolean;
    source: 'calculated' | 'manual';
}

interface Props {
    holidays: HolidayRow[];
    filters: { year: number };
}

export default function HolidaysIndex({ holidays, filters }: Props) {
    const [year, setYear] = useState(String(filters.year));
    const [newDate, setNewDate] = useState('');
    const [newName, setNewName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<HolidayRow | null>(null);
    const [syncing, setSyncing] = useState(false);

    const applyYear = () => {
        router.get(route('holidays.index'), { year }, { preserveState: true, replace: true });
    };

    const sync = () => {
        setSyncing(true);
        router.post(route('holidays.sync'), { year }, {
            preserveScroll: true,
            onFinish: () => setSyncing(false),
        });
    };

    const addManual = () => {
        if (!newDate || !newName.trim()) return;
        router.post(route('holidays.store'), { date: newDate, name: newName.trim() }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewDate('');
                setNewName('');
            },
        });
    };

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('holidays.destroy', confirmDelete.id), {
            preserveScroll: true,
            onSuccess: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Festivos">
            <Head title="Festivos" />
            <div className="space-y-6">
                <PageHeader
                    title="Festivos"
                    description="Calendario de festivos colombianos (Ley 51/1983 'Ley Emiliani'), usado para el recargo dominical/festivo de la nomina por horas."
                />

                <Card>
                    <div className="flex flex-wrap items-end gap-3">
                        <Input label="Año" type="number" value={year} onChange={(e) => setYear(e.target.value)} containerClassName="w-32" />
                        <Button variant="outline" onClick={applyYear}>Ver año</Button>
                        <Can permission="holidays.index.sync">
                            <Button
                                variant="secondary"
                                icon={<ArrowPathIcon className="h-4 w-4" />}
                                onClick={sync}
                                loading={syncing}
                            >
                                Sincronizar año
                            </Button>
                        </Can>
                    </div>
                </Card>

                <Can permission="holidays.index.create">
                    <Card>
                        <CardHeader title="Agregar festivo manual" description="Para casos puntuales fuera del patron habitual (ej. una ley que agrega un festivo especifico)." />
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr_auto]">
                            <Input label="Fecha" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                            <Input label="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Virgen de Chiquinquira" />
                            <div className="flex items-end">
                                <Button icon={<PlusIcon className="h-4 w-4" />} onClick={addManual} disabled={!newDate || !newName.trim()}>
                                    Agregar
                                </Button>
                            </div>
                        </div>
                    </Card>
                </Can>

                <Card>
                    <CardHeader title={`Festivos ${filters.year}`} />
                    <div className="mt-4">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Fecha</TableHeader>
                                    <TableHeader>Nombre</TableHeader>
                                    <TableHeader align="center">Trasladado</TableHeader>
                                    <TableHeader align="center">Origen</TableHeader>
                                    <TableHeader></TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {holidays.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No hay festivos para este año. Usa &quot;Sincronizar año&quot;.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    holidays.map((h) => (
                                        <TableRow key={h.id}>
                                            <TableCell>{formatDate(h.date)}</TableCell>
                                            <TableCell>{h.name}</TableCell>
                                            <TableCell align="center">
                                                {h.is_emiliani_shifted ? <Badge variant="info">Sí</Badge> : <Badge variant="neutral">No</Badge>}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Badge variant={h.source === 'manual' ? 'primary' : 'neutral'}>
                                                    {h.source === 'manual' ? 'Manual' : 'Calculado'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell align="right" data-label="">
                                                {h.source === 'manual' && (
                                                    <Can permission="holidays.index.delete">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                            onClick={() => setConfirmDelete(h)}
                                                        />
                                                    </Can>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmDelete !== null}
                title="Eliminar festivo"
                message={`¿Eliminar "${confirmDelete?.name}"?`}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(null)}
                variant="danger"
            />
        </AppLayout>
    );
}
