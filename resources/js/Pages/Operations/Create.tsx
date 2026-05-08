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

export default function OperationCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        base_price: '',
        is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('operations.store'));
    };

    return (
        <AppLayout title="Nueva operacion">
            <Head title="Nueva operacion" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva operacion"
                    breadcrumbs={[
                        { label: 'Operaciones', href: route('operations.index') },
                        { label: 'Nueva' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('operations.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos de la operacion" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input label="Precio base" type="number" step="0.01" value={data.base_price} onChange={(e) => setData('base_price', e.target.value)} error={errors.base_price} prefix="$" required />
                        <Textarea label="Descripcion" value={data.description} onChange={(e) => setData('description', e.target.value)} error={errors.description} className="sm:col-span-2" rows={3} />
                        <div className="sm:col-span-2">
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activa" />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
