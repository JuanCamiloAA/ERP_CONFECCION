import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, ScaleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';

interface LegalParameterRow {
    id: number;
    company_id: number | null;
    effective_from: string;
    effective_to: string | null;
    weekly_legal_hours: string | number;
    monthly_hours_divisor: string | number;
    night_start_time: string;
    night_end_time: string;
    night_surcharge_percent: string | number;
    overtime_day_percent: string | number;
    overtime_night_percent: string | number;
    sunday_holiday_surcharge_percent: string | number;
    max_overtime_hours_per_day: string | number;
    max_overtime_hours_per_week: string | number;
    discount_unexcused_absences: boolean;
    absence_discount_percent: string | number;
    legal_reference: string | null;
}

interface Props {
    parameters: LegalParameterRow[];
    isSuperAdmin: boolean;
}

export default function PayrollLegalParametersIndex({ parameters, isSuperAdmin }: Props) {
    const [confirmDelete, setConfirmDelete] = useState<LegalParameterRow | null>(null);

    const handleDelete = () => {
        if (!confirmDelete) return;
        router.delete(route('payroll-legal-parameters.destroy', confirmDelete.id), {
            onSuccess: () => setConfirmDelete(null),
        });
    };

    return (
        <AppLayout title="Parametros Legales de Nomina">
            <Head title="Parametros Legales de Nomina" />
            <div className="space-y-6">
                <PageHeader
                    title="Parametros Legales de Nomina"
                    description="Jornada, horarios, recargos, horas extra e inasistencias que rigen la liquidacion de la modalidad 'Por horas (legal)'."
                    action={
                        <Can permission="payroll_legal_parameters.index.create">
                            <Link href={route('payroll-legal-parameters.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo tramo</Button>
                            </Link>
                        </Can>
                    }
                />

                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                    <ScaleIcon className="h-5 w-5 shrink-0" />
                    <p>
                        Estos valores determinan como se paga la jornada, los recargos, las horas extra y las inasistencias de
                        todas las nominas. <strong>Verificalos con tu asesor legal/contable antes de aprobar nomina real.</strong>{' '}
                        El descuento por inasistencia en particular tiene matices legales genuinos (no confundir con el tope del
                        20% de multas disciplinarias del art. 113 CST) — activalo solo con ese acompañamiento.
                    </p>
                </div>

                <Card>
                    <CardHeader
                        title="Tramos de vigencia"
                        description={
                            isSuperAdmin
                                ? 'Se muestran los tramos globales (aplican a toda empresa sin tramo propio) y los de la empresa activa seleccionada.'
                                : 'Se muestran los tramos globales (de referencia, solo lectura) y los propios de tu empresa.'
                        }
                    />
                    <div className="mt-4">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Vigencia</TableHeader>
                                    <TableHeader>Alcance</TableHeader>
                                    <TableHeader align="right">Jornada/Divisor</TableHeader>
                                    <TableHeader>Nocturno</TableHeader>
                                    <TableHeader align="right">Recargos (noct./extra d./extra n./dom-fest)</TableHeader>
                                    <TableHeader align="center">Descuento inasistencia</TableHeader>
                                    <TableHeader></TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {parameters.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            No hay tramos configurados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    parameters.map((p) => {
                                        const isGlobal = p.company_id === null;
                                        const canEdit = !isGlobal || isSuperAdmin;
                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    {formatDate(p.effective_from)} —{' '}
                                                    {p.effective_to ? formatDate(p.effective_to) : 'vigente'}
                                                    {p.legal_reference && (
                                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.legal_reference}</p>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={isGlobal ? 'neutral' : 'primary'}>
                                                        {isGlobal ? 'Global (default)' : 'Esta empresa'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {p.weekly_legal_hours}h / {p.monthly_hours_divisor}
                                                </TableCell>
                                                <TableCell>
                                                    {String(p.night_start_time).slice(0, 5)} - {String(p.night_end_time).slice(0, 5)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {p.night_surcharge_percent}% / {p.overtime_day_percent}% / {p.overtime_night_percent}% /{' '}
                                                    {p.sunday_holiday_surcharge_percent}%
                                                </TableCell>
                                                <TableCell align="center">
                                                    {p.discount_unexcused_absences ? (
                                                        <Badge variant="warning">{p.absence_discount_percent}% activo</Badge>
                                                    ) : (
                                                        <Badge variant="neutral">Desactivado</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" data-label="">
                                                    {canEdit ? (
                                                        <div className="flex justify-end gap-1">
                                                            <Can permission="payroll_legal_parameters.index.edit">
                                                                <Link href={route('payroll-legal-parameters.edit', p.id)}>
                                                                    <Button variant="ghost" size="sm" icon={<PencilSquareIcon className="h-4 w-4" />} />
                                                                </Link>
                                                            </Can>
                                                            <Can permission="payroll_legal_parameters.index.delete">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                                    onClick={() => setConfirmDelete(p)}
                                                                />
                                                            </Can>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Solo lectura</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            <ConfirmDialog
                open={confirmDelete !== null}
                title="Eliminar tramo"
                message={`¿Eliminar el tramo desde ${confirmDelete ? formatDate(confirmDelete.effective_from) : ''}? Esta accion no se puede deshacer.`}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(null)}
                variant="danger"
            />
        </AppLayout>
    );
}
