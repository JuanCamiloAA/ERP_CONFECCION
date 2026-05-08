import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Switch } from '@/Components/UI/Switch';
import AppLayout from '@/Layouts/AppLayout';
import type { Bank } from '@/types';

interface Props {
    bank: Bank;
}

export default function BankEdit({ bank }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        name: bank.name,
        code: bank.code ?? '',
        is_active: bank.is_active,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('banks.update', bank.id));
    };

    return (
        <AppLayout title={`Editar ${bank.name}`}>
            <Head title={`Editar ${bank.name}`} />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title={`Editar ${bank.name}`}
                    breadcrumbs={[
                        { label: 'Bancos', href: route('banks.index') },
                        { label: 'Editar' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('banks.index')}>
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
                    <CardHeader title="Datos del banco" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input label="Nombre" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                        <Input label="Codigo (opcional)" value={data.code} onChange={(e) => setData('code', e.target.value)} error={errors.code} />
                        <div className="sm:col-span-2">
                            <Switch checked={data.is_active} onChange={(v) => setData('is_active', v)} label="Activo" />
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
