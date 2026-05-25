import type { ComponentProps } from 'react';
import { BuildingOffice2Icon, BuildingOfficeIcon, LinkIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/Components/UI/Badge';
import { Card, CardHeader } from '@/Components/UI/Card';
import { StatCard } from '@/Components/UI/StatCard';
import { formatDate } from '@/lib/utils';
import type { MembershipRow, SuperAdminStats } from './dashboard-types';

function membershipBadgeLabel(badge: MembershipRow['badge']) {
    switch (badge) {
        case 'expired':
            return 'Vencida';
        case 'critical':
            return 'Crítico';
        case 'warning':
            return 'Advertencia';
        default:
            return 'OK';
    }
}

function membershipBadgeVariant(badge: MembershipRow['badge']): ComponentProps<typeof Badge>['variant'] {
    switch (badge) {
        case 'expired':
        case 'critical':
            return 'danger';
        case 'warning':
            return 'warning';
        default:
            return 'success';
    }
}

interface Props {
    stats: SuperAdminStats;
}

export default function SuperAdminOverview({ stats }: Props) {
    const focused = stats.focused_company_id != null && stats.focused_company_summary != null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {focused ? stats.focused_company_summary?.company_name : 'Administración'}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {focused
                        ? 'Conteos operativos de la empresa seleccionada (sin totales financieros consolidados).'
                        : 'Visión consolidada sin montos financieros por empresa. Usa el selector superior para ver una empresa concreta.'}
                </p>
            </div>

            {!focused ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard
                        title="Empresas activas"
                        value={stats.companies_active_count}
                        subtitle="Empresas con estado activo"
                        icon={<BuildingOffice2Icon className="h-6 w-6" />}
                        color="sky"
                    />
                    <StatCard
                        title="Empresas registradas"
                        value={stats.companies_total_count}
                        subtitle="Total en el sistema"
                        icon={<BuildingOfficeIcon className="h-6 w-6" />}
                        color="indigo"
                    />
                    <StatCard
                        title="Empleados activos"
                        value={stats.employees_active_count}
                        subtitle="Todas las empresas"
                        icon={<UsersIcon className="h-6 w-6" />}
                        color="emerald"
                    />
                    <StatCard
                        title="Usuarios staff"
                        value={stats.users_staff_count}
                        subtitle="Cuentas sin vínculo a empleado"
                        icon={<UserGroupIcon className="h-6 w-6" />}
                        color="amber"
                    />
                    <StatCard
                        title="Usuarios vinculados"
                        value={stats.users_linked_employee_count}
                        subtitle="Con cuenta y empleado asociado"
                        icon={<LinkIcon className="h-6 w-6" />}
                        color="rose"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        title="Empleados activos (empresa)"
                        value={stats.focused_company_summary?.employees_active_count ?? 0}
                        subtitle="Empresa seleccionada"
                        icon={<UsersIcon className="h-6 w-6" />}
                        color="emerald"
                    />
                    <StatCard
                        title="Usuarios staff (empresa)"
                        value={stats.focused_company_summary?.users_staff_count ?? 0}
                        icon={<UserGroupIcon className="h-6 w-6" />}
                        color="amber"
                    />
                    <StatCard
                        title="Usuarios vinculados (empresa)"
                        value={stats.focused_company_summary?.users_linked_employee_count ?? 0}
                        icon={<LinkIcon className="h-6 w-6" />}
                        color="rose"
                    />
                </div>
            )}

            <Card>
                <CardHeader
                    title="Empresas y membresías"
                    description={
                        focused
                            ? `Plan y vencimiento de ${stats.memberships.length === 1 ? 'esta empresa' : 'las empresas filtradas'}.`
                            : 'Todos los registros empresa con plan y fecha de membresía.'
                    }
                />
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                <th className="pb-3 pr-2">Empresa</th>
                                <th className="pb-3 pr-2">Plan</th>
                                <th className="pb-3 pr-2">Fin membresía</th>
                                <th className="pb-3 pr-2 text-center">Vencimiento</th>
                                <th className="pb-3 pr-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {stats.memberships.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-slate-400">
                                        No hay empresas que mostrar.
                                    </td>
                                </tr>
                            ) : (
                                stats.memberships.map((row) => (
                                    <tr key={row.id} className="text-slate-800 dark:text-slate-100">
                                        <td className="py-3 pr-2 align-top font-medium">{row.name}</td>
                                        <td className="py-3 pr-2 align-top text-slate-600 dark:text-slate-400">{row.plan_name}</td>
                                        <td className="py-3 pr-2 align-top text-slate-600 dark:text-slate-400">
                                            {row.membership_ends_at ? formatDate(row.membership_ends_at) : '—'}
                                        </td>
                                        <td className="py-3 px-2 text-center align-top">
                                            <Badge variant={membershipBadgeVariant(row.badge)}>{membershipBadgeLabel(row.badge)}</Badge>
                                        </td>
                                        <td className="py-3 px-2 text-center align-top">
                                            <Badge variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Empresa activa' : 'Inactiva'}</Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
