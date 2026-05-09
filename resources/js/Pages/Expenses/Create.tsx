import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';

interface CategoryOption {
    id: number;
    name: string;
}

interface Props {
    categories: CategoryOption[];
}

export default function ExpenseCreate({ categories }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        category_id: categories[0]?.id ? String(categories[0].id) : '',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().slice(0, 10),
        notes: '',
        receipt: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('expenses.store'), { forceFormData: true });
    };

    return (
        <AppLayout title="Registrar gasto">
            <Head title="Registrar gasto" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Registrar gasto"
                    breadcrumbs={[
                        { label: 'Gastos', href: route('expenses.index') },
                        { label: 'Nuevo' },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('expenses.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" loading={processing} disabled={categories.length === 0}>
                                Guardar
                            </Button>
                        </div>
                    }
                />

                {categories.length === 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        Debe crear al menos una{' '}
                        <Link href={route('expense-categories.create')} className="font-semibold underline">
                            categoria de gasto
                        </Link>{' '}
                        antes de registrar gastos.
                    </p>
                ) : null}

                <Card>
                    <CardHeader title="Datos del gasto" />
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Categoria</label>
                            <select
                                value={data.category_id}
                                onChange={(e) => setData('category_id', e.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                required
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id ? <p className="mt-1 text-xs text-rose-500">{errors.category_id}</p> : null}
                        </div>
                        <Input
                            label="Monto (COP)"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                            error={errors.amount}
                            required
                        />
                        <Input
                            label="Fecha del gasto"
                            type="date"
                            value={data.expense_date}
                            onChange={(e) => setData('expense_date', e.target.value)}
                            error={errors.expense_date}
                            required
                        />
                        <div className="sm:col-span-2">
                            <Textarea
                                label="Descripcion / concepto"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                error={errors.description}
                                rows={3}
                                required
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Textarea
                                label="Notas (opcional)"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                error={errors.notes}
                                rows={2}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Comprobante <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                onChange={(e) => setData('receipt', e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white dark:text-slate-300"
                            />
                            {errors.receipt ? <p className="mt-1 text-xs text-rose-500">{errors.receipt}</p> : null}
                            <p className="mt-1 text-xs text-slate-500">PDF o imagen (JPG, PNG, WEBP). Max. 10 MB.</p>
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
