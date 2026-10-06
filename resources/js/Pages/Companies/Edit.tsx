import { Head } from '@inertiajs/react';
import { CompanyForm, type BillingCycleOption, type CompanyFormCompany } from '@/Components/Companies/CompanyForm';
import { CompanyMembershipPanel, type MembershipAdmin } from '@/Components/Companies/CompanyMembershipPanel';
import type { PlanOption } from '@/Components/Companies/PlanRadioList';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    company: CompanyFormCompany;
    membershipPlans: PlanOption[];
    billingCycles: BillingCycleOption[];
    membershipAdmin: MembershipAdmin;
}

export default function CompanyEdit({ company, membershipPlans, billingCycles, membershipAdmin }: Props) {
    return (
        <AppLayout title={`Editar ${company.name}`}>
            <Head title={`Editar ${company.name}`} />
            <CompanyForm plans={membershipPlans} cycles={billingCycles} company={company} />
            {/* Fuera del formulario: el pago manual tiene su propio envío. */}
            <div className="mt-6 pb-24">
                <CompanyMembershipPanel companyId={company.id} membership={membershipAdmin} />
            </div>
        </AppLayout>
    );
}
