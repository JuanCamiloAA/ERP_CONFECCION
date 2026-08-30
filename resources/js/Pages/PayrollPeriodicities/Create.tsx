import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { slugifyCode } from '@/lib/slugifyCode';

export default function PayrollPeriodicityCreate() {
    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        name: '',
        description: '',
        is_active: true,
    });

    const changes = useMemo(
        () =>
            [data.code !== '', data.name !== '', data.description !== '', data.is_active !== true].filter(Boolean)
                .length,
        [data],
    );

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
                        <Link href={route('payroll-periodicities.index')} className="shrink-0">
                            <Button
                                type="button"
                                variant="ghost"
                                icon={<ArrowLeftIcon className="h-4 w-4" />}
                                className="whitespace-nowrap shrink-0"
                            >
                                Volver al listado
                            </Button>
                        </Link>
                    }
                />

                <Card className="mx-auto max-w-2xl">
                    <CardHeader
                        title="Datos"
                        description="El código se guarda en las nóminas y en la configuración de cada empresa; después no se puede cambiar."
                    />
                    <div className="mt-4 space-y-4">
                        <Input
                            label="Nombre visible"
                            value={data.name}
                            onChange={(e) => {
                                // El codigo sigue al nombre mientras no se toque a mano; asi el
                                // caso normal no obliga a inventarse un identificador.
                                setData((current) => ({
                                    ...current,
                                    name: e.target.value,
                                    code: slugifyCode(e.target.value),
                                }));
                            }}
                            error={errors.name}
                            required
                        />

                        <Input
                            label="Codigo interno"
                            value={data.code}
                            onChange={(e) => setData('code', slugifyCode(e.target.value))}
                            error={errors.code}
                            description="Solo letras minusculas, numeros y guion bajo"
                            required
                        />

                        <Textarea
                            label="Descripcion (opcional)"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            error={errors.description}
                            rows={2}
                        />

                        <Switch
                            checked={data.is_active}
                            onChange={(v) => setData('is_active', v)}
                            label="Activa"
                            description="Las inactivas no aparecen en selectores nuevos"
                        />
                    </div>
                </Card>

                <StickySaveBar
                    changes={changes}
                    processing={processing}
                    onCancel={() => reset()}
                    submitLabel="Crear periodicidad"
                />
            </form>
        </AppLayout>
    );
}
