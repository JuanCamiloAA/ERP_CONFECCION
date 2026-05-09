import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent, useEffect } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { slugify } from '@/lib/utils';

export default function MembershipPlanCreate() {
    const { data, setData, post, processing, errors, transform } = useForm({
        name: '',
        slug: '',
        max_staff_users: '',
        max_employees: '',
        price_monthly: '',
        features_text: '',
        is_active: true,
        sort_order: '0',
    });

    useEffect(() => {
        if (data.name && !data.slug) {
            setData('slug', slugify(data.name).replace(/_/g, '-'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.name]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => {
            const lines = d.features_text
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
            return {
                name: d.name,
                slug: d.slug.replace(/_/g, '-'),
                max_staff_users: d.max_staff_users === '' ? null : Number(d.max_staff_users),
                max_employees: d.max_employees === '' ? null : Number(d.max_employees),
                price_monthly: d.price_monthly === '' ? null : Number(d.price_monthly),
                features_json: lines.length ? lines : null,
                is_active: d.is_active,
                sort_order: Number(d.sort_order) || 0,
            };
        });
        post(route('super-admin.membership-plans.store'));
    };

    return (
        <AppLayout title="Nuevo plan">
            <Head title="Nuevo plan" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Nuevo plan de membresia"
                    breadcrumbs={[{ label: 'Planes', href: route('super-admin.membership-plans.index') }, { label: 'Nuevo' }]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('super-admin.membership-plans.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" loading={processing}>
                                Crear
                            </Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader title="Datos" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input label="Slug" value={data.slug} onChange={(e) => setData('slug', e.target.value)} error={errors.slug} required />
                        <Input
                            type="number"
                            label="Max usuarios staff (vacio = ilimitado)"
                            value={data.max_staff_users}
                            onChange={(e) => setData('max_staff_users', e.target.value)}
                            error={errors.max_staff_users}
                        />
                        <Input
                            type="number"
                            label="Max empleados (vacio = ilimitado)"
                            value={data.max_employees}
                            onChange={(e) => setData('max_employees', e.target.value)}
                            error={errors.max_employees}
                        />
                        <Input
                            type="number"
                            label="Precio mensual (opcional)"
                            value={data.price_monthly}
                            onChange={(e) => setData('price_monthly', e.target.value)}
                            error={errors.price_monthly}
                        />
                        <Input
                            type="number"
                            label="Orden"
                            value={data.sort_order}
                            onChange={(e) => setData('sort_order', e.target.value)}
                            error={errors.sort_order}
                        />
                    </div>
                    <div className="mt-4">
                        <Textarea
                            label="Caracteristicas (una por linea)"
                            value={data.features_text}
                            onChange={(e) => setData('features_text', e.target.value)}
                            rows={5}
                        />
                    </div>
                    <div className="mt-4">
                        <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Plan activo" />
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
