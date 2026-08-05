import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import {
    PayrollLegalParameterFields,
    type PayrollLegalParameterFormData,
} from '@/Components/PayrollLegalParameters/PayrollLegalParameterFields';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { PageHeader } from '@/Components/UI/PageHeader';
import AppLayout from '@/Layouts/AppLayout';

interface ParameterProp {
    id: number;
    company_id: number | null;
    effective_from: string;
    effective_to: string | null;
    weekly_legal_hours: string | number;
    monthly_hours_divisor: string | number;
    night_start_time: string;
    night_end_time: string;
    night_surcharge_percent: string | number;
    overtime_day_percent: string | number;
    overtime_night_percent: string | number;
    sunday_holiday_surcharge_percent: string | number;
    max_overtime_hours_per_day: string | number;
    max_overtime_hours_per_week: string | number;
    discount_unexcused_absences: boolean;
    absence_discount_percent: string | number;
    legal_reference: string | null;
}

interface Props {
    parameter: ParameterProp;
}

export default function PayrollLegalParameterEdit({ parameter }: Props) {
    const { data, setData, put, processing, errors } = useForm<PayrollLegalParameterFormData>({
        effective_from: parameter.effective_from.slice(0, 10),
        effective_to: parameter.effective_to ? parameter.effective_to.slice(0, 10) : '',
        weekly_legal_hours: String(parameter.weekly_legal_hours),
        monthly_hours_divisor: String(parameter.monthly_hours_divisor),
        night_start_time: String(parameter.night_start_time).slice(0, 5),
        night_end_time: String(parameter.night_end_time).slice(0, 5),
        night_surcharge_percent: String(parameter.night_surcharge_percent),
        overtime_day_percent: String(parameter.overtime_day_percent),
        overtime_night_percent: String(parameter.overtime_night_percent),
        sunday_holiday_surcharge_percent: String(parameter.sunday_holiday_surcharge_percent),
        max_overtime_hours_per_day: String(parameter.max_overtime_hours_per_day),
        max_overtime_hours_per_week: String(parameter.max_overtime_hours_per_week),
        discount_unexcused_absences: parameter.discount_unexcused_absences,
        absence_discount_percent: String(parameter.absence_discount_percent),
        legal_reference: parameter.legal_reference ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('payroll-legal-parameters.update', parameter.id));
    };

    return (
        <AppLayout title="Editar tramo de parametros legales">
            <Head title="Editar tramo de parametros legales" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Editar tramo de parametros legales"
                    breadcrumbs={[
                        { label: 'Parametros Legales', href: route('payroll-legal-parameters.index') },
                        { label: 'Editar' },
                    ]}
                    action={
                        <div className="flex items-center gap-2">
                            <Badge variant={parameter.company_id === null ? 'neutral' : 'primary'}>
                                {parameter.company_id === null ? 'Global' : 'Esta empresa'}
                            </Badge>
                            <Link href={route('payroll-legal-parameters.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button>
                            </Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <PayrollLegalParameterFields data={data} setData={setData} errors={errors} />
            </form>
        </AppLayout>
    );
}
