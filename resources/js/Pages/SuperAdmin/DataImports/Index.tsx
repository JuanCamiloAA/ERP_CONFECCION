import { Head, Link, router } from '@inertiajs/react';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { FormEventHandler, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import type { DataImportBatch, PaginatedResponse } from '@/types';

const TYPE_KEYS = ['companies', 'banks', 'operations', 'references', 'employees_users'] as const;

interface Props {
    batches: PaginatedResponse<DataImportBatch>;
    types: Record<string, string>;
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

function canProcessBatch(status: string): boolean {
    return status === 'pending' || status === 'failed';
}

export default function DataImportsIndex({ batches, types }: Props) {
    const [openHelp, setOpenHelp] = useState(true);
    const [uploadingType, setUploadingType] = useState<string | null>(null);
    const [processingBatchId, setProcessingBatchId] = useState<number | null>(null);

    const submitImport: (type: string) => FormEventHandler<HTMLFormElement> =
        (type) => (e) => {
            e.preventDefault();
            if (uploadingType) {
                return;
            }
            const form = e.currentTarget;
            const fd = new FormData(form);
            fd.set('type', type);
            setUploadingType(type);
            router.post(route('super-admin.data-imports.store'), fd, {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => form.reset(),
                onError: (errors) => {
                    const message =
                        (typeof errors.file === 'string' && errors.file) ||
                        (typeof errors.type === 'string' && errors.type) ||
                        'No se pudo subir el archivo. Revisa el CSV e intenta de nuevo.';
                    toast.error(message);
                },
                onFinish: () => setUploadingType(null),
            });
        };

    const runProcess = (batchId: number) => {
        if (processingBatchId !== null) {
            return;
        }
        setProcessingBatchId(batchId);
        router.post(route('super-admin.data-imports.process', batchId), {}, {
            preserveScroll: true,
            onFinish: () => setProcessingBatchId(null),
        });
    };

    return (
        <AppLayout title="Importacion CSV">
            <Head title="Importacion masiva (CSV)" />
            <div className="space-y-8">
                <PageHeader
                    title="Importacion masiva (CSV)"
                    description="Sube el CSV y pulsa «Procesar» en el historial para ejecutar la importacion al instante (sin colas)."
                />

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <button
                        type="button"
                        onClick={() => setOpenHelp(!openHelp)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
                    >
                        Instrucciones y orden recomendado
                        {openHelp ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                    </button>
                    {openHelp && (
                        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <p>
                                Codificacion <strong>UTF-8</strong>, separador coma, encabezados en snake_case (igual que las plantillas). Fechas{' '}
                                <code className="rounded bg-slate-100 px-1 dark:bg-slate-900">YYYY-MM-DD</code>.
                            </p>
                            <ol className="list-decimal space-y-1 pl-5">
                                <li>Empresas</li>
                                <li>Bancos (requiere company_nit)</li>
                                <li>Operaciones</li>
                                <li>Referencias</li>
                                <li>Empleados y usuarios</li>
                            </ol>
                            <p className="text-slate-500 dark:text-slate-400">
                                Tras cargar el archivo quedara en estado <strong>Pendiente</strong>. Use el boton <strong>Procesar</strong> en el historial para importar los datos.
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                                Modo empresas: si el NIT existe, puede <strong>omitir</strong> la fila o <strong>actualizar</strong> datos. Empleados: marque actualizar
                                existentes para sobrescribir por numero de documento.
                            </p>
                        </div>
                    )}
                </div>

                <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Descargar plantillas</h2>
                    <div className="flex flex-wrap gap-2">
                        {TYPE_KEYS.map((key) => (
                            <a
                                key={key}
                                href={route('super-admin.data-imports.templates', key)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                {types[key] ?? key}
                            </a>
                        ))}
                        <a
                            href={route('super-admin.data-imports.templates.zip')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Paquete ZIP + LEEME
                        </a>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cargar archivos</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {TYPE_KEYS.map((key) => (
                            <form
                                key={key}
                                onSubmit={submitImport(key)}
                                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">{types[key] ?? key}</h3>
                                {key === 'companies' && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Si el NIT ya existe</label>
                                        <select
                                            name="company_import_mode"
                                            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                            defaultValue="skip"
                                        >
                                            <option value="skip">Omitir fila</option>
                                            <option value="update">Actualizar empresa</option>
                                        </select>
                                    </div>
                                )}
                                {key === 'employees_users' && (
                                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" name="employee_update_existing" value="1" className="rounded border-slate-300 dark:border-slate-600" />
                                        Actualizar empleado si existe (mismo documento en la empresa)
                                    </label>
                                )}
                                <input
                                    type="file"
                                    name="file"
                                    accept=".csv"
                                    required
                                    className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium dark:text-slate-300 dark:file:bg-slate-700"
                                />
                                <Button type="submit" size="sm" loading={uploadingType === key} disabled={uploadingType !== null}>
                                    {uploadingType === key ? 'Subiendo…' : 'Cargar CSV'}
                                </Button>
                            </form>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Historial</h2>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Fecha</TableHeader>
                                <TableHeader>Usuario</TableHeader>
                                <TableHeader>Tipo</TableHeader>
                                <TableHeader>Archivo</TableHeader>
                                <TableHeader align="center">Estado</TableHeader>
                                <TableHeader align="center">OK / Error</TableHeader>
                                <TableHeader align="right">Acciones</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {batches.data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No hay importaciones registradas.
                                    </td>
                                </tr>
                            ) : (
                                batches.data.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell className="whitespace-nowrap text-sm">{new Date(b.created_at).toLocaleString()}</TableCell>
                                        <TableCell className="text-sm">
                                            {b.user ? `${b.user.name} ${b.user.last_name ?? ''}`.trim() : `ID ${b.user_id}`}
                                        </TableCell>
                                        <TableCell className="text-sm">{types[b.type] ?? b.type}</TableCell>
                                        <TableCell className="max-w-[12rem] truncate text-sm" title={b.original_filename}>
                                            {b.original_filename}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Badge variant={statusVariant(b.status)}>{statusLabel(b.status)}</Badge>
                                        </TableCell>
                                        <TableCell align="center" className="text-sm tabular-nums">
                                            {b.rows_success} / {b.rows_failed}
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                {canProcessBatch(b.status) ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="success"
                                                        loading={processingBatchId === b.id}
                                                        disabled={processingBatchId !== null}
                                                        onClick={() => runProcess(b.id)}
                                                    >
                                                        {processingBatchId === b.id ? 'Procesando…' : 'Procesar'}
                                                    </Button>
                                                ) : null}
                                                <Link
                                                    href={route('super-admin.data-imports.show', b.id)}
                                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                                >
                                                    Ver detalle
                                                </Link>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <Pagination links={batches.links} meta={batches.meta} />
                </section>
            </div>
        </AppLayout>
    );
}
