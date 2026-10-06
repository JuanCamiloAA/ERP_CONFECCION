import { Head } from '@inertiajs/react';
import { CompanyForm, type BillingCycleOption } from '@/Components/Companies/CompanyForm';
import type { PlanOption } from '@/Components/Companies/PlanRadioList';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    membershipPlans: PlanOption[];
    billingCycles: BillingCycleOption[];
}

export default function CompanyCreate({ membershipPlans, billingCycles }: Props) {
    return (
        <AppLayout title="Nueva empresa">
            <Head title="Nueva empresa" />
            <CompanyForm plans={membershipPlans} cycles={billingCycles} />
        </AppLayout>
    );
}
