import { Head } from '@inertiajs/react';
import { MembershipPlanForm } from '@/Components/MembershipPlans/MembershipPlanForm';
import AppLayout from '@/Layouts/AppLayout';

export default function MembershipPlanCreate() {
    return (
        <AppLayout title="Nuevo plan">
            <Head title="Nuevo plan" />
            <MembershipPlanForm />
        </AppLayout>
    );
}
