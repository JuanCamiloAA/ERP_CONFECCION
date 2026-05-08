import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import type { Employee } from '@/types';

interface Props {
    employees: Employee[];
}

export default function AdvanceCreate({ employees }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        employee_id: '' as number | '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reason: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('advances.store'));
    };

    return (
        <AppLayout title="Nuevo anticipo">
            <Head title="Nuevo anticipo" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo anticipo"
                    breadcrumbs={[{ label: 'Anticipos', href: route('advances.index') }, { label: 'Nuevo' }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('advances.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos del anticipo" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Empleado"
                            value={data.employee_id}
                            onChange={(e) => setData('employee_id', Number(e.target.value))}
                            error={errors.employee_id}
                            options={employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                            placeholder="Selecciona empleado"
                            required
                        />
                        <Input label="Fecha" type="date" value={data.date} onChange={(e) => setData('date', e.target.value)} error={errors.date} required />
                        <Input label="Monto" type="number" step="0.01" value={data.amount} onChange={(e) => setData('amount', e.target.value)} error={errors.amount} prefix="$" required />
                        <Textarea label="Motivo" value={data.reason} onChange={(e) => setData('reason', e.target.value)} error={errors.reason} className="sm:col-span-2" rows={3} required />
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
