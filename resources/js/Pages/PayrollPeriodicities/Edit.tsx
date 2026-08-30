import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { type FormEvent, useMemo } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { StickySaveBar } from '@/Components/UI/StickySaveBar';
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
    payrolls_count: number;
}

interface Props {
    periodicity: Periodicity;
    companiesCount: number;
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

export default function PayrollPeriodicityEdit({ periodicity, companiesCount }: Props) {
    const initial = useMemo(
        () => ({
            name: periodicity.name,
            description: periodicity.description ?? '',
            is_active: periodicity.is_active,
        }),
        [periodicity],
    );

    const { data, setData, put, processing, errors, reset } = useForm(initial);

    const changes = useMemo(
        () =>
            (Object.keys(initial) as (keyof typeof initial)[]).filter((key) => data[key] !== initial[key]).length,
        [data, initial],
    );

    // Solo avisa si de verdad se esta apagando algo que esta en uso.
    const deactivating = periodicity.is_active && ! data.is_active;
    const inUse = (periodicity.payrolls_count ?? 0) > 0 || companiesCount > 0;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('payroll-periodicities.update', periodicity.id), { preserveScroll: true });
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
                        description="El codigo interno no se modifica para no alterar nominas existentes. El orden se cambia desde el listado."
                    />
                    <div className="mt-4 space-y-4">
                        <Input label="Codigo" value={periodicity.code} disabled readOnly />

                        <Input
                            label="Nombre visible"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            error={errors.name}
                            required
                        />

                        <Textarea
                            label="Descripcion (opcional)"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            error={errors.description}
                            rows={2}
                        />

                        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                            <Switch
                                checked={data.is_active}
                                onChange={(v) => setData('is_active', v)}
                                label="Activa"
                                description="Las inactivas no aparecen en selectores nuevos"
                            />

                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                La usan {plural(periodicity.payrolls_count ?? 0, 'nómina', 'nóminas')} y{' '}
                                {plural(companiesCount, 'empresa', 'empresas')} como periodicidad por defecto.
                            </p>

                            {deactivating && inUse ? (
                                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                    <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>
                                        Las nóminas existentes se conservan, pero dejará de ofrecerse al crear nuevas.
                                        {companiesCount > 0
                                            ? ' Las empresas que la tienen por defecto volverán a la periodicidad quincenal.'
                                            : ''}
                                    </span>
                                </p>
                            ) : null}
                        </div>
                    </div>
                </Card>

                <StickySaveBar changes={changes} processing={processing} onCancel={() => reset()} />
            </form>
        </AppLayout>
    );
}
