import { Head } from '@inertiajs/react';
import { CompanyForm, type CompanyFormCompany } from '@/Components/Companies/CompanyForm';
import type { PlanOption } from '@/Components/Companies/PlanRadioList';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    company: CompanyFormCompany;
    membershipPlans: PlanOption[];
}

export default function CompanyEdit({ company, membershipPlans }: Props) {
    return (
        <AppLayout title={`Editar ${company.name}`}>
            <Head title={`Editar ${company.name}`} />
            <CompanyForm plans={membershipPlans} company={company} />
        </AppLayout>
    );
}
