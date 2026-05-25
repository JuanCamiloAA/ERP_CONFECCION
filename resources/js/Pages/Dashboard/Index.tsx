import type { ReactElement } from 'react';
import type { CompanyAdminStats, DashboardVariant, EmployeeStats, SuperAdminStats } from './dashboard-types';
import { Head } from '@inertiajs/react';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { EmptyState } from '@/Components/UI/EmptyState';
import AppLayout from '@/Layouts/AppLayout';
import CompanyAdminOverview from './CompanyAdminOverview';
import EmployeeOverview from './EmployeeOverview';
import SuperAdminOverview from './SuperAdminOverview';

interface Props {
    variant: DashboardVariant | null | undefined;
    stats: SuperAdminStats | CompanyAdminStats | EmployeeStats | null | undefined;
    requireCompany: boolean | undefined;
}

export default function Dashboard({ variant = null, stats = null, requireCompany = false }: Props) {
    if (requireCompany || stats == null) {
        return (
            <AppLayout title="Dashboard">
                <Head title="Dashboard" />
                <EmptyState
                    icon={<BuildingOfficeIcon className="h-12 w-12" />}
                    title="Selecciona una empresa"
                    description="Tu cuenta no esta asociada a una empresa activa (o debes seleccionar empresa en sesion)."
                />
            </AppLayout>
        );
    }

    let content: ReactElement | null = null;
    switch (variant) {
        case 'super_admin':
            content = <SuperAdminOverview stats={stats as SuperAdminStats} />;
            break;
        case 'company_admin':
            content = <CompanyAdminOverview stats={stats as CompanyAdminStats} />;
            break;
        case 'employee':
            content = <EmployeeOverview stats={stats as EmployeeStats} />;
            break;
        default:
            content = (
                <EmptyState
                    icon={<BuildingOfficeIcon className="h-12 w-12" />}
                    title="Sin datos de vista"
                    description="No se pudo determinar el tipo de dashboard. Actualiza la pagina."
                />
            );
    }

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />
            {content}
        </AppLayout>
    );
}
