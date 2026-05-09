import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { FormEvent } from 'react';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import type { ExpenseDetail } from '@/types';

interface CategoryOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface Props {
    expense: ExpenseDetail;
    categories: CategoryOption[];
}

export default function ExpenseEdit({ expense, categories }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        category_id: String(expense.category?.id ?? ''),
        amount: String(expense.amount),
        description: expense.description,
        expense_date: expense.expense_date,
        notes: expense.notes ?? '',
        receipt: null as File | null,
        _method: 'put',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('expenses.update', expense.id), { forceFormData: true });
    };

    return (
        <AppLayout title={`Editar gasto #${expense.id}`}>
            <Head title="Editar gasto" />
            <form onSubmit={submit} className="space-y-6">
                <PageHeader
                    title="Editar gasto"
                    breadcrumbs={[
                        { label: 'Gastos', href: route('expenses.index') },
                        { label: `#${expense.id}` },
                    ]}
                    action={
                        <div className="flex gap-2">
                            <Link href={route('expenses.index')}>
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
                                        {!c.is_active ? ' (inactiva)' : ''}
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
                        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Comprobante actual</p>
                            {expense.receipt_url ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge variant="info">{expense.receipt_mime?.includes('pdf') ? 'PDF' : 'Imagen'}</Badge>
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{expense.receipt_original_name ?? 'Archivo'}</span>
                                    <a
                                        href={expense.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400"
                                    >
                                        Ver <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                    </a>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-slate-500">Sin archivo.</p>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Reemplazar comprobante (opcional)
                            </label>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                onChange={(e) => setData('receipt', e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white dark:text-slate-300"
                            />
                            {errors.receipt ? <p className="mt-1 text-xs text-rose-500">{errors.receipt}</p> : null}
                            <p className="mt-1 text-xs text-slate-500">Si sube un archivo, reemplaza el anterior.</p>
                        </div>
                    </div>
                </Card>
            </form>
        </AppLayout>
    );
}
