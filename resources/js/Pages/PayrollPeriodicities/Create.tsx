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

export default function PayrollPeriodicityCreate() {
    const { data, setData, post, processing, errors } = useForm({
        code: '',
        name: '',
        description: '',
        sort_order: 0,
        is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payroll-periodicities.store'));
    };

    return (
        <AppLayout title="Nueva periodicidad">
            <Head title="Nueva periodicidad" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva periodicidad"
                    breadcrumbs={[
                        { label: 'Periodicidad de pagos', href: route('payroll-periodicities.index') },
                        { label: 'Nueva' },
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
                    <CardHeader
                        title="Datos"
                        description="Codigo en minusculas, sin espacios (ej. semanal, decadal). Se guarda en nominas y configuracion."
                    />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Codigo interno"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                            error={errors.code}
                            required
                            description="Solo letras minusculas, numeros y guion bajo"
                        />
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
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activo" description="Las inactivas no aparecen en selectores nuevos" />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
