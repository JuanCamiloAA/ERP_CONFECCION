import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Can } from '@/Components/UI/Can';
import { Card, CardHeader } from '@/Components/UI/Card';
import { PageHeader } from '@/Components/UI/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { ExpenseDetail } from '@/types';

interface Props {
    expense: ExpenseDetail;
}

export default function ExpenseShow({ expense }: Props) {
    return (
        <AppLayout title={`Gasto #${expense.id}`}>
            <Head title={`Gasto #${expense.id}`} />
            <div className="space-y-6">
                <PageHeader
                    title={`Gasto #${expense.id}`}
                    breadcrumbs={[
                        { label: 'Gastos', href: route('expenses.index') },
                        { label: `#${expense.id}` },
                    ]}
                    action={
                        <div className="flex flex-wrap gap-2">
                            <Link href={route('expenses.index')}>
                                <Button variant="ghost" icon={<ArrowLeftIcon className="h-4 w-4" />}>
                                    Volver
                                </Button>
                            </Link>
                            <Can permission="expenses.index.edit">
                                <Link href={route('expenses.edit', expense.id)}>
                                    <Button icon={<PencilSquareIcon className="h-4 w-4" />}>Editar</Button>
                                </Link>
                            </Can>
                        </div>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader title="Resumen" />
                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate-500">Fecha del gasto</dt>
                                <dd className="font-medium text-slate-900 dark:text-slate-100">{formatDate(expense.expense_date)}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate-500">Registrado el</dt>
                                <dd className="font-medium text-slate-900 dark:text-slate-100">
                                    {expense.created_at ? formatDateTime(expense.created_at) : '—'}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate-500">Categoria</dt>
                                <dd className="font-medium text-slate-900 dark:text-slate-100">{expense.category?.name ?? '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate-500">Monto</dt>
                                <dd className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(expense.amount)}</dd>
                            </div>
                            <div>
                                <dt className="text-slate-500">Descripcion</dt>
                                <dd className="mt-1 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{expense.description}</dd>
                            </div>
                            {expense.notes ? (
                                <div>
                                    <dt className="text-slate-500">Notas</dt>
                                    <dd className="mt-1 whitespace-pre-wrap text-slate-900 dark:text-slate-100">{expense.notes}</dd>
                                </div>
                            ) : null}
                            {expense.creator ? (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-slate-500">Registrado por</dt>
                                    <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                                        {expense.creator.full_name}
                                        <span className="block text-xs font-normal text-slate-500">{expense.creator.email}</span>
                                    </dd>
                                </div>
                            ) : null}
                        </dl>
                    </Card>

                    <Card>
                        <CardHeader title="Comprobante" />
                        <div className="mt-4">
                            {expense.receipt_url ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="info">{expense.receipt_mime?.includes('pdf') ? 'PDF' : 'Imagen'}</Badge>
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{expense.receipt_original_name ?? 'Archivo'}</span>
                                    </div>
                                    <a
                                        href={expense.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                                    >
                                        Abrir comprobante <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                    </a>
                                    {expense.receipt_mime && !expense.receipt_mime.includes('pdf') ? (
                                        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                                            <img src={expense.receipt_url} alt="Comprobante" className="max-h-96 w-full object-contain" />
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No hay comprobante cargado.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
