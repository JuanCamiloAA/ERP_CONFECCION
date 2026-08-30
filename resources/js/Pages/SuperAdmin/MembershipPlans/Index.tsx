import { Head, Link, router } from '@inertiajs/react';
import { PencilSquareIcon, PlusIcon, RectangleStackIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { EmptyState } from '@/Components/UI/EmptyState';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import { ViewToggle } from '@/Components/UI/ViewToggle';
import { PlanCard } from '@/Components/MembershipPlans/PlanCard';
import { useViewMode } from '@/hooks/useViewMode';
import AppLayout from '@/Layouts/AppLayout';
import type { PaginatedResponse } from '@/types';

interface PlanRow {
    id: number;
    name: string;
    slug: string;
    max_staff_users: number | null;
    max_employees: number | null;
    price_monthly: string | null;
    features_json: string[] | null;
    is_active: boolean;
    sort_order: number;
    companies_count: number;
}

interface Props {
    plans: PaginatedResponse<PlanRow>;
    featuredPlanId: number | null;
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function limit(value: number | null): string {
    return value == null ? 'Ilimitado' : String(value);
}

export default function MembershipPlansIndex({ plans, featuredPlanId }: Props) {
    const [confirm, setConfirm] = useState<PlanRow | null>(null);
    // Por defecto tarjetas: esta pantalla se abre mas veces para comparar planes que para
    // corregir un campo suelto.
    const [view, setView] = useViewMode('membership-plans', 'cards');

    const destroy = () => {
        if (! confirm) return;
        router.delete(route('super-admin.membership-plans.destroy', confirm.id), {
            preserveScroll: true,
            onFinish: () => setConfirm(null),
        });
    };

    const companiesLink = (plan: PlanRow) => (
        <Link
            href={route('companies.index', { plan: plan.slug })}
            className="font-medium tabular-nums text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
            {plan.companies_count} {plan.companies_count === 1 ? 'empresa' : 'empresas'}
        </Link>
    );

    return (
        <AppLayout title="Planes de membresia">
            <Head title="Planes de membresia" />

            <div className="space-y-6">
                <PageHeader
                    title="Planes de membresia"
                    description="Limites de usuarios staff y empleados por plan."
                    action={
                        <Link href={route('super-admin.membership-plans.create')} className="shrink-0">
                            <Button icon={<PlusIcon className="h-4 w-4" />} className="whitespace-nowrap shrink-0">
                                Nuevo plan
                            </Button>
                        </Link>
                    }
                />

                <div className="flex justify-end">
                    <ViewToggle value={view} onChange={setView} />
                </div>

                {plans.data.length === 0 ? (
                    <EmptyState
                        icon={<RectangleStackIcon className="h-8 w-8" />}
                        title="No hay planes"
                        description="Crea uno o ejecuta LandingSeeder."
                        action={
                            <Link href={route('super-admin.membership-plans.create')}>
                                <Button icon={<PlusIcon className="h-4 w-4" />}>Nuevo plan</Button>
                            </Link>
                        }
                    />
                ) : view === 'cards' ? (
                    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
                        {plans.data.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                highlighted={plan.id === featuredPlanId}
                                footer={
                                    <>
                                        {companiesLink(plan)}
                                        <Link href={route('super-admin.membership-plans.edit', plan.id)}>
                                            <Button variant="outline" size="sm">
                                                Editar plan
                                            </Button>
                                        </Link>
                                    </>
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Plan</TableHeader>
                                <TableHeader align="right">Staff max</TableHeader>
                                <TableHeader align="right">Empleados max</TableHeader>
                                <TableHeader align="right">Precio / mes</TableHeader>
                                <TableHeader align="right">Empresas</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {plans.data.map((plan) => (
                                <TableRow key={plan.id}>
                                    <TableCell>
                                        <div className="font-medium text-slate-900 dark:text-slate-100">{plan.name}</div>
                                        <div className="font-mono text-xs text-slate-500">{plan.slug}</div>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">{limit(plan.max_staff_users)}</span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">{limit(plan.max_employees)}</span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <span className="tabular-nums">
                                            {plan.price_monthly != null ? money.format(Number(plan.price_monthly)) : '—'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">{companiesLink(plan)}</TableCell>
                                    <TableCell align="center">
                                        <Badge variant={plan.is_active ? 'success' : 'danger'}>
                                            {plan.is_active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={route('super-admin.membership-plans.edit', plan.id)}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={<PencilSquareIcon className="h-4 w-4" />}
                                                    aria-label={`Editar ${plan.name}`}
                                                />
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<TrashIcon className="h-4 w-4 text-rose-500" />}
                                                onClick={() => setConfirm(plan)}
                                                aria-label={`Eliminar ${plan.name}`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                <Pagination links={plans.links} from={plans.from} to={plans.to} total={plans.total} />
            </div>

            <ConfirmDialog
                open={!! confirm}
                onClose={() => setConfirm(null)}
                onConfirm={destroy}
                title="Eliminar plan"
                message={
                    confirm && confirm.companies_count > 0
                        ? `${confirm.companies_count} ${confirm.companies_count === 1 ? 'empresa quedara' : 'empresas quedaran'} sin plan asignado y sin limites de usuarios.`
                        : 'Las empresas con este plan quedaran sin plan asignado.'
                }
                confirmText="Eliminar"
                variant="danger"
            />
        </AppLayout>
    );
}
