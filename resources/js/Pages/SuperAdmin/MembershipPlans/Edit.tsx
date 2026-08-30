import { Head } from '@inertiajs/react';
import { MembershipPlanForm, type PlanFormPlan } from '@/Components/MembershipPlans/MembershipPlanForm';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    plan: PlanFormPlan;
}

export default function MembershipPlanEdit({ plan }: Props) {
    return (
        <AppLayout title={`Editar ${plan.name}`}>
            <Head title={`Editar ${plan.name}`} />
            <MembershipPlanForm plan={plan} />
        </AppLayout>
    );
}
