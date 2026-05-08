import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent, useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';

interface Props {
    defaultPayrollType: string;
}

export default function PayrollCreate({ defaultPayrollType }: Props) {
    const page = usePage<App.PageProps>();
    const payrollPeriodicities = page.props.payrollPeriodicities ?? [];

    const typeOptions = useMemo(
        () => payrollPeriodicities.map((p) => ({ value: p.code, label: p.name })),
        [payrollPeriodicities],
    );

    const initialType = useMemo(() => {
        if (typeOptions.some((o) => o.value === defaultPayrollType)) {
            return defaultPayrollType;
        }
        return typeOptions[0]?.value ?? defaultPayrollType;
    }, [defaultPayrollType, typeOptions]);

    const { data, setData, post, processing, errors } = useForm({
        name: `Nomina ${new Date().toLocaleString('es', { month: 'long', year: 'numeric' })}`,
        period_start: '',
        period_end: '',
        type: initialType,
        notes: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payrolls.store'));
    };

    return (
        <AppLayout title="Nueva nomina">
            <Head title="Nueva nomina" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva nomina"
                    breadcrumbs={[{ label: 'Nominas', href: route('payrolls.index') }, { label: 'Nueva' }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('payrolls.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Crear</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos del periodo" description="Se creara en estado borrador. Luego podras calcular." />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required containerClassName="sm:col-span-2" />
                        <Input label="Fecha inicio" type="date" value={data.period_start} onChange={(e) => setData('period_start', e.target.value)} error={errors.period_start} required />
                        <Input label="Fecha fin" type="date" value={data.period_end} onChange={(e) => setData('period_end', e.target.value)} error={errors.period_end} required />
                        <Select
                            label="Tipo"
                            value={data.type}
                            onChange={(e) => setData('type', e.target.value)}
                            error={errors.type}
                            options={typeOptions}
                            required
                        />
                        <Textarea label="Notas" value={data.notes} onChange={(e) => setData('notes', e.target.value)} className="sm:col-span-2" rows={3} />
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
