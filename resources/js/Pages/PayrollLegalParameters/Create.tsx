import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import {
    PayrollLegalParameterFields,
    type PayrollLegalParameterFormData,
} from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    isSuperAdmin: boolean;
}

export default function PayrollLegalParameterCreate({ isSuperAdmin }: Props) {
    const { data, setData, post, processing, errors } = useForm<PayrollLegalParameterFormData & { is_global: boolean }>({
        is_global: false,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        weekly_legal_hours: '42',
        monthly_hours_divisor: '210',
        night_start_time: '19:00',
        night_end_time: '06:00',
        night_surcharge_percent: '35',
        overtime_day_percent: '25',
        overtime_night_percent: '75',
        sunday_holiday_surcharge_percent: '90',
        max_overtime_hours_per_day: '2',
        max_overtime_hours_per_week: '12',
        discount_unexcused_absences: false,
        absence_discount_percent: '100',
        legal_reference: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payroll-legal-parameters.store'));
    };

    return (
        <AppLayout title="Nuevo tramo de parametros legales">
            <Head title="Nuevo tramo de parametros legales" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo tramo de parametros legales"
                    breadcrumbs={[
                        { label: 'Parametros Legales', href: route('payroll-legal-parameters.index') },
                        { label: 'Nuevo' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('payroll-legal-parameters.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                {isSuperAdmin && (
                    <Card>
                        <Switch
                            checked={data.is_global}
                            onChange={(v) => setData('is_global', v)}
                            label="Tramo global (default de sistema)"
                            description="Solo super_admin. Si lo desactivas, el tramo se crea para la empresa activa seleccionada."
                        />
                    </Card>
                )}

                <PayrollLegalParameterFields data={data} setData={setData} errors={errors} />
            </form>
        </AppLayout>
    );
}
