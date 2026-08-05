import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent, useMemo } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS, difficultyLabel, levelFromMinutes } from '@/lib/difficulty';

export default function OperationCreate() {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        base_price: '',
        estimated_minutes: '',
        is_active: true,
    });

    const previewLevel = useMemo(() => {
        const minutes = Number(data.estimated_minutes);
        return data.estimated_minutes !== '' && Number.isFinite(minutes) && minutes > 0
            ? levelFromMinutes(minutes, thresholds)
            : null;
    }, [data.estimated_minutes, thresholds]);

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
                        <div>
                            <Input
                                label="Minutos estandar"
                                type="number"
                                step="0.1"
                                min={0.1}
                                value={data.estimated_minutes}
                                onChange={(e) => setData('estimated_minutes', e.target.value)}
                                error={errors.estimated_minutes}
                                suffix="min"
                                description="Tiempo estandar para realizar la operacion; define automaticamente el grado de dificultad."
                                required
                            />
                            {previewLevel && (
                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    Dificultad calculada: <Badge variant="info">{previewLevel} - {difficultyLabel(previewLevel)}</Badge>
                                </p>
                            )}
                        </div>
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
