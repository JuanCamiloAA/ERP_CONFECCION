import { Head } from '@inertiajs/react';
import { CompanyForm } from '@/Components/Companies/CompanyForm';
import type { PlanOption } from '@/Components/Companies/PlanRadioList';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    membershipPlans: PlanOption[];
}

export default function CompanyCreate({ membershipPlans }: Props) {
    return (
        <AppLayout title="Nueva empresa">
            <Head title="Nueva empresa" />
            <CompanyForm plans={membershipPlans} />
        </AppLayout>
    );
}
