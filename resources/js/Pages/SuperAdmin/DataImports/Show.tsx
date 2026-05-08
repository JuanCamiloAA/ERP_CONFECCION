import { Head, Link } from '@inertiajs/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Badge } from '@/Components/UI/Badge';
import AppLayout from '@/Layouts/AppLayout';
import type { DataImportBatch } from '@/types';

interface RowErr {
    line: number;
    message: string;
}

interface Props {
    batch: DataImportBatch;
    errors_preview: RowErr[];
    errors_truncated: boolean;
    errors_total: number;
}

function statusLabel(status: string): string {
    const map: Record<string, string> = {
        pending: 'Pendiente',
        processing: 'Procesando',
        completed: 'Completado',
        failed: 'Fallido',
    };
    return map[status] ?? status;
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'processing') return 'warning';
    return 'neutral';
}

export default function DataImportsShow({ batch, errors_preview, errors_truncated, errors_total }: Props) {
    const fatal = batch.meta && typeof batch.meta === 'object' && 'fatal_error' in batch.meta ? String((batch.meta as { fatal_error?: string }).fatal_error) : null;

    return (
        <AppLayout title="Detalle importacion">
            <Head title={`Importacion #${batch.id}`} />
            <div className="space-y-6">
                <PageHeader
                    title={`Importacion #${batch.id}`}
                    description={batch.original_filename}
                    action={
                        <Link
                            href={route('super-admin.data-imports.index')}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                            Volver al listado
                        </Link>
                    }
                />

                <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 md:grid-cols-2">
                    <div>
                        <span className="text-slate-500 dark:text-slate-400">Estado</span>
                        <div className="mt-1">
                            <Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge>
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-500 dark:text-slate-400">Filas OK / con error</span>
                        <p className="mt-1 font-medium tabular-nums text-slate-800 dark:text-slate-100">
                            {batch.rows_success} / {batch.rows_failed}
                        </p>
                    </div>
                    <div>
                        <span className="text-slate-500 dark:text-slate-400">Subido por</span>
                        <p className="mt-1 text-slate-800 dark:text-slate-100">
                            {batch.user ? `${batch.user.name} ${batch.user.last_name ?? ''}`.trim() : `Usuario #${batch.user_id}`}
                            {batch.user?.email ? <span className="block text-xs text-slate-500">{batch.user.email}</span> : null}
                        </p>
                    </div>
                    <div>
                        <span className="text-slate-500 dark:text-slate-400">Tiempos</span>
                        <p className="mt-1 text-slate-800 dark:text-slate-100">
                            Inicio: {batch.started_at ? new Date(batch.started_at).toLocaleString() : '—'}
                            <br />
                            Fin: {batch.finished_at ? new Date(batch.finished_at).toLocaleString() : '—'}
                        </p>
                    </div>
                </div>

                {fatal && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                        <strong>Error irrecuperable:</strong> {fatal}
                    </div>
                )}

                {errors_total > 0 && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Errores por linea ({errors_total})
                            </h2>
                            <a
                                href={route('super-admin.data-imports.errors', batch.id)}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Descargar JSON completo
                            </a>
                        </div>
                        {errors_truncated && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Mostrando las primeras {errors_preview.length} entradas. Descargue el JSON para ver todas.
                            </p>
                        )}
                        <ul className="max-h-96 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
                            {errors_preview.map((err, i) => (
                                <li key={i} className="border-b border-slate-200 pb-2 last:border-0 dark:border-slate-700">
                                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">Linea {err.line}:</span>{' '}
                                    <span className="text-slate-600 dark:text-slate-300">{err.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {errors_total === 0 && batch.status === 'completed' && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Importacion finalizada sin errores registrados por fila.</p>
                )}
            </div>
        </AppLayout>
    );
}
