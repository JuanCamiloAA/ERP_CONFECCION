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

export default function PayrollConceptCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        code: '',
        description: '',
        is_active: true,
        sort_order: 0,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('payroll-concepts.store'));
    };

    return (
        <AppLayout title="Nuevo concepto de nomina">
            <Head title="Nuevo concepto" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo concepto de nomina"
                    breadcrumbs={[
                        { label: 'Conceptos', href: route('payroll-concepts.index') },
                        { label: 'Nuevo' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('payroll-concepts.index')}>
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
                    <CardHeader title="Datos" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input
                            label="Codigo (opcional)"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                            error={errors.code}
                        />
                        <Input
                            label="Orden"
                            type="number"
                            value={String(data.sort_order)}
                            onChange={(e) => setData('sort_order', parseInt(e.target.value, 10) || 0)}
                            error={errors.sort_order}
                        />
                        <div className="sm:col-span-2">
                            <Textarea
                                label="Descripcion (opcional)"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                error={errors.description}
                                rows={3}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Switch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Activo"
                                description="Los conceptos inactivos no aparecen al agregar ajustes en una nomina"
                            />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
