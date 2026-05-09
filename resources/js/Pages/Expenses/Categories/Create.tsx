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

export default function ExpenseCategoryCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        is_active: true,
        sort_order: 0,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('expense-categories.store'));
    };

    return (
        <AppLayout title="Nueva categoria de gasto">
            <Head title="Nueva categoria" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nueva categoria de gasto"
                    breadcrumbs={[
                        { label: 'Categorias', href: route('expense-categories.index') },
                        { label: 'Nueva' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('expense-categories.index')}>
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
                                label="Activa"
                                description="Las inactivas no aparecen al crear nuevos gastos"
                            />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
