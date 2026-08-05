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
import type { Operation } from '@/types';

interface Props {
    operation: Operation;
}

export default function OperationEdit({ operation }: Props) {
    const thresholds = usePage<App.PageProps>().props.difficultyMinuteThresholds ?? DEFAULT_DIFFICULTY_MINUTE_THRESHOLDS;

    const { data, setData, put, processing, errors } = useForm({
        name: operation.name,
        description: operation.description ?? '',
        base_price: String(operation.base_price ?? ''),
        estimated_minutes: String(operation.estimated_minutes ?? ''),
        is_active: operation.is_active,
    });

    const previewLevel = useMemo(() => {
        const minutes = Number(data.estimated_minutes);
        return data.estimated_minutes !== '' && Number.isFinite(minutes) && minutes > 0
            ? levelFromMinutes(minutes, thresholds)
            : null;
    }, [data.estimated_minutes, thresholds]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('operations.update', operation.id));
    };

    return (
        <AppLayout title="Editar operacion">
            <Head title={`Editar ${operation.name}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${operation.name}`}
                    breadcrumbs={[
                        { label: 'Operaciones', href: route('operations.index') },
                        { label: 'Editar' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('operations.index')}><Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>Cancelar</Button></Link>
                            <Button type="submit" loading={processing}>Guardar</Button>
                        </div>
                    }
                />

                <Card>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                    {previewLevel === operation.difficulty_level ? null : (
                                        <span className="ml-1">(actual: {operation.difficulty_level} - {difficultyLabel(operation.difficulty_level)})</span>
                                    )}
                                </p>
                            )}
                        </div>
                        <Textarea label="Descripcion" value={data.description} onChange={(e) => setData('description', e.target.value)} className="sm:col-span-2" rows={3} />
                        <div className="sm:col-span-2">
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activa" />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
