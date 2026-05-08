import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';

interface Periodicity {
    id: number;
    code: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
}

interface Props {
    periodicity: Periodicity;
}

export default function PayrollPeriodicityEdit({ periodicity }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        name: periodicity.name,
        description: periodicity.description ?? '',
        sort_order: periodicity.sort_order,
        is_active: periodicity.is_active,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('payroll-periodicities.update', periodicity.id));
    };

    return (
        <AppLayout title={`Editar ${periodicity.name}`}>
            <Head title={`Editar ${periodicity.name}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${periodicity.name}`}
                    breadcrumbs={[
                        { label: 'Periodicidad de pagos', href: route('payroll-periodicities.index') },
                        { label: periodicity.name },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('payroll-periodicities.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" loading={processing}>
                                Guardar
                            </Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos" description="El codigo interno no se modifica para no alterar nominas existentes." />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Codigo" value={periodicity.code} disabled containerClassName="sm:col-span-2" />
                        <Input label="Nombre visible" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input
                            type="number"
                            label="Orden"
                            value={data.sort_order}
                            onChange={(e) => setData('sort_order', Number(e.target.value))}
                            error={errors.sort_order}
                        />
                        <Textarea
                            label="Descripcion (opcional)"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            error={errors.description}
                            className="sm:col-span-2"
                            rows={2}
                        />
                        <div className="sm:col-span-2">
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activo" />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
