import { Head, Link } from '@inertiajs/react';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { Button } from '@/Components/UI/Button';

import { PageHeader } from '@/Components/UI/PageHeader';

import { ProductionRegisterForm, type ReferenceWithOps } from '@/Components/Productions/ProductionRegisterForm';
import { WorkDayBanner } from '@/Components/Productions/WorkDayBanner';
import { Can } from '@/Components/UI/Can';

import AppLayout from '@/Layouts/AppLayout';

import type { Employee } from '@/types';



interface Props {
    employees: Employee[];
    references: ReferenceWithOps[];
    workDaySelectableEmployees?: Pick<Employee, 'id' | 'first_name' | 'last_name'>[];
}



export default function ProductionCreate({ employees, references, workDaySelectableEmployees = [] }: Props) {

    return (

        <AppLayout title="Registrar produccion">

            <Head title="Registrar produccion" />

            <div className="space-y-6">

                <PageHeader

                    title="Registrar produccion"

                    breadcrumbs={[

                        { label: 'Produccion', href: route('productions.index') },

                        { label: 'Nueva' },

                    ]}

                    action={

                        <Link href={route('productions.index')}>

                            <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>

                                Volver al listado

                            </Button>

                        </Link>

                    }

                />

                {workDaySelectableEmployees.length > 0 ? (
                    <Can any={['productions.index.workday_start', 'productions.index.workday_close']}>
                        <WorkDayBanner variant="admin" selectableEmployees={workDaySelectableEmployees} />
                    </Can>
                ) : null}

                <ProductionRegisterForm employees={employees} references={references} submitButtonText="Guardar" />

            </div>

        </AppLayout>

    );

}

