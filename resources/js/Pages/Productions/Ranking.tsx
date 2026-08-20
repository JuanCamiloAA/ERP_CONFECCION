import { Head, router } from '@inertiajs/react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { Avatar } from '@/Components/UI/Avatar';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { EmptyState } from '@/Components/UI/EmptyState';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StatCard } from '@/Components/UI/StatCard';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';
import { cn, formatNumber } from '@/lib/utils';
import type { EmployeeRankingRow } from '@/types';

interface Props {
    filters: { start: string; end: string; only_confirmed: boolean };
    ranking: EmployeeRankingRow[];
}

const medalColors: Record<number, string> = {
    1: 'text-amber-500',
    2: 'text-slate-400',
    3: 'text-orange-700',
};

const rowHighlight: Record<number, string> = {
    1: 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/10',
    2: 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/20',
    3: 'border-orange-200 bg-orange-50/60 dark:border-orange-800/50 dark:bg-orange-900/10',
};

export default function ProductionRanking({ filters, ranking }: Props) {
    const [start, setStart] = useState(filters.start);
    const [end, setEnd] = useState(filters.end);
    const [onlyConfirmed, setOnlyConfirmed] = useState(filters.only_confirmed);

    const apply = () => {
        router.get(
            route('productions.ranking'),
            { start, end, only_confirmed: onlyConfirmed ? 1 : 0 },
            { preserveState: true, replace: true },
        );
    };

    const maxPoints = useMemo(() => Math.max(1, ...ranking.map((r) => r.total_points)), [ranking]);
    const totals = useMemo(
        () => ({
            employees: ranking.length,
            quantity: ranking.reduce((s, r) => s + r.total_quantity, 0),
            points: ranking.reduce((s, r) => s + r.total_points, 0),
        }),
        [ranking],
    );

    return (
        <AppLayout title="Ranking de Produccion">
            <Head title="Ranking de Produccion" />
            <div className="space-y-6">
                <PageHeader
                    title="Ranking de Produccion"
                    description="Podio de empleados segun unidades producidas, ponderadas por el grado de dificultad de cada operacion."
                />

                <Card>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
                        <Input label="Desde" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                        <Input label="Hasta" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                        <Switch
                            checked={onlyConfirmed}
                            onChange={setOnlyConfirmed}
                            label="Solo confirmadas"
                            description="Excluye produccion pendiente por confirmar"
                        />
                        <div className="flex sm:justify-end">
                            <Button onClick={apply}>Aplicar</Button>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard title="Empleados en el ranking" value={formatNumber(totals.employees)} color="indigo" />
                    <StatCard title="Unidades totales" value={formatNumber(totals.quantity)} color="emerald" />
                    <StatCard
                        title="Puntos totales"
                        value={formatNumber(totals.points)}
                        color="amber"
                        subtitle="Puntos = unidades x grado de dificultad de la operacion"
                    />
                </div>

                <Card>
                    <CardHeader
                        title="Podio de empleados"
                        description="Ordenado por puntos (unidades ponderadas por dificultad). El grado de dificultad se define en la operacion y puede ajustarse por referencia."
                    />

                    {ranking.length === 0 ? (
                        <EmptyState
                            className="mt-4 py-10"
                            title="Sin produccion en el rango seleccionado"
                            description="Ajusta las fechas o incluye produccion pendiente para ver resultados."
                        />
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {ranking.map((row) => (
                                <li
                                    key={row.employee_id}
                                    className={cn(
                                        'flex items-center gap-4 rounded-xl border p-4 transition-colors',
                                        rowHighlight[row.position] ?? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
                                    )}
                                >
                                    <div className="flex w-10 shrink-0 items-center justify-center">
                                        {row.position <= 3 ? (
                                            <TrophyIcon className={cn('h-7 w-7', medalColors[row.position])} />
                                        ) : (
                                            <span className="text-sm font-semibold text-slate-400">{row.position}</span>
                                        )}
                                    </div>

                                    <Avatar name={row.employee?.full_name ?? 'Empleado'} src={row.employee?.photo} size="md" zoomable />

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {row.employee?.full_name ?? `Empleado #${row.employee_id}`}
                                        </p>
                                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full',
                                                    row.position === 1 ? 'bg-amber-500' : 'bg-indigo-500',
                                                )}
                                                style={{ width: `${Math.max(4, Math.round((row.total_points / maxPoints) * 100))}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                            {formatNumber(row.total_points)}
                                            <span className="ml-1 text-xs font-normal text-slate-500">pts</span>
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatNumber(row.total_quantity)} unidades
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
