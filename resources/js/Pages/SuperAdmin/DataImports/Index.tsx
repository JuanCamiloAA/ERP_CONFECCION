import { Head, Link, router } from '@inertiajs/react';
import {
    AdjustmentsHorizontalIcon,
    ArrowDownTrayIcon,
    ArrowUpTrayIcon,
    DocumentTextIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { DragEvent, FormEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Modal } from '@/Components/UI/Modal';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Pagination } from '@/Components/UI/Pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/UI/Table';
import AppLayout from '@/Layouts/AppLayout';
import { cn } from '@/lib/utils';
import type { DataImportBatch, PaginatedResponse } from '@/types';

/**
 * Orden obligatorio de carga. Es la unica fuente de verdad del orden: la numeracion de
 * las filas y la cadena de la ayuda salen de aqui, no de una lista escrita aparte.
 */
const TYPE_KEYS = ['companies', 'banks', 'operations', 'references', 'reference_operations', 'employees_users'] as const;

type TypeKey = (typeof TYPE_KEYS)[number];

/** De que depende cada entidad. Es informativo: nunca bloquea la carga. */
const DEPENDS: Record<string, string> = {
    companies: 'Punto de partida. El NIT es la llave del resto de archivos.',
    banks: 'Requiere company_nit de una empresa ya cargada.',
    operations: 'Requiere company_nit.',
    references: 'Requiere company_nit.',
    reference_operations: 'Requiere que ya existan las referencias y las operaciones.',
    employees_users: 'Requiere company_nit. Si usa bank_name, el banco debe existir en esa empresa.',
};

/**
 * Agrupacion de campos para el selector. Vive en el front a proposito: una columna nueva
 * que el catalogo publique cae en «Otros» y sigue apareciendo sola, sin tocar backend.
 */
const GROUPS: Record<string, string[]> = {
    Identificación: [
        'company_nit', 'nit', 'name', 'first_name', 'last_name', 'document_type',
        'document_number', 'code', 'reference_code', 'operation_name',
    ],
    Contacto: ['phone', 'email', 'address'],
    Nómina: [
        'hire_date', 'base_salary', 'payroll_mode', 'daily_salary',
        'minutes_per_full_workday', 'ordinary_hours_per_day', 'is_exempt_from_overtime',
    ],
    'Acceso al sistema': ['create_user', 'user_email', 'user_password', 'role_name'],
    Banco: ['bank_name', 'bank_account_number', 'bank_key'],
    'Costo y tiempo': [
        'base_price', 'price', 'estimated_minutes', 'difficulty_level',
        'payment_per_unit', 'lot_total_quantity',
    ],
};

const groupOf = (key: string): string =>
    Object.entries(GROUPS).find(([, keys]) => keys.includes(key))?.[0] ?? 'Otros';

/** Seleccion sugerida por tipo: lo habitual sin llegar a la plantilla completa. */
const RECOMMENDED: Record<string, string[]> = {
    companies: ['name', 'nit', 'email', 'is_active'],
    banks: ['company_nit', 'name', 'code'],
    operations: ['company_nit', 'name', 'base_price', 'estimated_minutes'],
    references: ['company_nit', 'code', 'name', 'payment_per_unit', 'lot_total_quantity'],
    reference_operations: ['company_nit', 'reference_code', 'operation_name', 'price', 'estimated_minutes'],
    employees_users: [
        'company_nit', 'first_name', 'last_name', 'document_type', 'document_number',
        'phone', 'hire_date', 'base_salary', 'payroll_mode', 'is_active',
    ],
};

/** Un campo de plantilla, tal como lo publica App\Services\DataImport\ImportFieldCatalog. */
interface CatalogField {
    key: string;
    required: boolean;
    example: string;
    help: string | null;
    column: string | null;
}

interface FieldPreset {
    id: number;
    name: string;
    fields: string[];
    is_shared: boolean;
    is_own: boolean;
}

/** Ultimo lote de un tipo; llega recortado a lo que la fila necesita. */
interface LatestBatch {
    id: number;
    type: string;
    status: string;
    rows_total: number;
    rows_success: number;
    rows_failed: number;
    original_filename: string;
    created_at: string;
    error_report_path: string | null;
    meta?: Record<string, unknown> | null;
}

interface Filters {
    q: string;
    estado: string;
    tipo: string;
}

interface Props {
    batches: PaginatedResponse<DataImportBatch>;
    types: Record<string, string>;
    filters: Filters;
    /** Campos disponibles por tipo; sale de la tabla, asi que crece solo. */
    fieldCatalog: Record<string, CatalogField[]>;
    latestByType?: Record<string, LatestBatch> | null;
    fieldPresets?: Record<string, FieldPreset[]> | null;
    maxUploadKb?: number;
    csvPreview?: CsvPreviewPayload | null;
    csvPreviewError?: string | null;
}

interface CsvPreviewPayload {
    batch_id: number;
    filename: string;
    type: string;
    headers: string[];
    rows: string[][];
    truncated: boolean;
    total_data_rows: number;
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

function canDeleteBatch(status: string): boolean {
    return status !== 'processing';
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DataImportsIndex({
    batches,
    types,
    filters,
    fieldCatalog = {},
    latestByType = null,
    fieldPresets = null,
    maxUploadKb = 5120,
    csvPreview = null,
    csvPreviewError = null,
}: Props) {
    const [uploadingType, setUploadingType] = useState<string | null>(null);
    const [processingBatchId, setProcessingBatchId] = useState<number | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<CsvPreviewPayload | null>(null);
    const [previewBatchId, setPreviewBatchId] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<DataImportBatch | null>(null);
    const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);

    /** Archivo elegido por fila, venga del selector o de arrastrarlo encima. */
    const [picked, setPicked] = useState<Record<string, File | null>>({});
    const [dragOver, setDragOver] = useState<string | null>(null);
    /** Tarjetas «en espera» que el usuario desplego a mano para cargar igual. */
    const [expandidas, setExpandidas] = useState<string[]>([]);
    const [historialAbierto, setHistorialAbierto] = useState(false);
    const [plantillasAbierto, setPlantillasAbierto] = useState(false);

    /**
     * Campos elegidos por tipo. Arranca con todos marcados, que es la plantilla completa
     * de siempre; los obligatorios van igual aunque no esten en la lista, porque el
     * backend los reinyecta y sin ellos el archivo no se puede importar.
     */
    const [selectedFields, setSelectedFields] = useState<Record<string, string[]>>(() =>
        Object.fromEntries(Object.entries(fieldCatalog).map(([type, fields]) => [type, fields.map((f) => f.key)])),
    );
    const [fieldPickerType, setFieldPickerType] = useState<string | null>(null);
    const [fieldQuery, setFieldQuery] = useState('');
    const [activePreset, setActivePreset] = useState<Record<string, string>>({});
    const [savePresetFor, setSavePresetFor] = useState<string | null>(null);
    const [presetName, setPresetName] = useState('');
    const [presetShared, setPresetShared] = useState(false);
    const [savingPreset, setSavingPreset] = useState(false);

    const [q, setQ] = useState(filters?.q ?? '');
    const primeraCarga = useRef(true);

    /* ------------------------------------------------------------- catalogo */

    const fieldsOf = (type: string): CatalogField[] => fieldCatalog[type] ?? [];
    const chosenOf = (type: string): string[] => selectedFields[type] ?? fieldsOf(type).map((f) => f.key);
    const requiredOf = (type: string): CatalogField[] => fieldsOf(type).filter((f) => f.required);
    const optionalOf = (type: string): CatalogField[] => fieldsOf(type).filter((f) => !f.required);
    const presetsOf = (type: string): FieldPreset[] => fieldPresets?.[type] ?? [];

    /** Cuenta lo que realmente saldra en el CSV: lo marcado mas los obligatorios. */
    const effectiveCount = (type: string): number => {
        const elegidos = new Set(chosenOf(type));
        requiredOf(type).forEach((f) => elegidos.add(f.key));

        return elegidos.size;
    };

    /** Solo se manda la lista si se recorto algo: sin parametro, el servidor da todos. */
    const fieldsParam = (type: string): string | null => {
        const todos = fieldsOf(type);
        const elegidos = chosenOf(type);

        return todos.length === 0 || elegidos.length === todos.length ? null : elegidos.join(',');
    };

    const templateHref = (type: string): string => {
        const fields = fieldsParam(type);

        return route('super-admin.data-imports.templates', fields ? { type, fields } : { type });
    };

    const zipHref = (): string => {
        // Se arma a mano y no con Ziggy porque la seleccion viaja anidada (fields[tipo]).
        const partes = TYPE_KEYS.map((type) => {
            const fields = fieldsParam(type);

            return fields ? `fields[${type}]=${encodeURIComponent(fields)}` : null;
        }).filter((p): p is string => p !== null);

        const base = route('super-admin.data-imports.templates.zip');

        return partes.length > 0 ? `${base}?${partes.join('&')}` : base;
    };

    const aplicarSeleccion = (type: string, keys: string[], preset: string) => {
        setSelectedFields((prev) => ({ ...prev, [type]: keys }));
        setActivePreset((prev) => ({ ...prev, [type]: preset }));
    };

    const toggleField = (type: string, key: string) => {
        const actuales = chosenOf(type);
        aplicarSeleccion(
            type,
            actuales.includes(key) ? actuales.filter((k) => k !== key) : [...actuales, key],
            'Personalizado',
        );
    };

    /** Marca o desmarca un grupo entero; los obligatorios no se tocan. */
    const toggleGroup = (type: string, grupo: string, marcar: boolean) => {
        const delGrupo = optionalOf(type).filter((f) => groupOf(f.key) === grupo).map((f) => f.key);
        const actuales = chosenOf(type);
        const siguiente = marcar
            ? Array.from(new Set([...actuales, ...delGrupo]))
            : actuales.filter((k) => !delGrupo.includes(k));

        aplicarSeleccion(type, siguiente, 'Personalizado');
    };

    const aplicarPreset = (type: string, nombre: 'Mínimo' | 'Recomendado' | 'Completo') => {
        if (nombre === 'Completo') {
            aplicarSeleccion(type, fieldsOf(type).map((f) => f.key), nombre);

            return;
        }
        if (nombre === 'Mínimo') {
            aplicarSeleccion(type, requiredOf(type).map((f) => f.key), nombre);

            return;
        }

        // Se filtra contra el catalogo vivo: una columna retirada no rompe el preset.
        const sugeridos = (RECOMMENDED[type] ?? []).filter((k) => fieldsOf(type).some((f) => f.key === k));
        aplicarSeleccion(type, Array.from(new Set([...requiredOf(type).map((f) => f.key), ...sugeridos])), nombre);
    };

    const aplicarPresetGuardado = (type: string, preset: FieldPreset) => {
        const validos = preset.fields.filter((k) => fieldsOf(type).some((f) => f.key === k));
        aplicarSeleccion(type, Array.from(new Set([...requiredOf(type).map((f) => f.key), ...validos])), preset.name);
    };

    const guardarPreset = () => {
        const type = savePresetFor;
        if (!type || savingPreset) return;

        const nombre = presetName.trim();
        if (nombre === '') {
            toast.error('Ponle un nombre al preset.');

            return;
        }

        const campos = Array.from(new Set([...requiredOf(type).map((f) => f.key), ...chosenOf(type)]));
        setSavingPreset(true);
        router.post(
            route('super-admin.data-import-presets.store'),
            { type, name: nombre, fields: campos, is_shared: presetShared },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setActivePreset((prev) => ({ ...prev, [type]: nombre }));
                    setSavePresetFor(null);
                    setPresetName('');
                    setPresetShared(false);
                },
                onError: () => toast.error('No se pudo guardar el preset.'),
                onFinish: () => setSavingPreset(false),
            },
        );
    };

    const borrarPreset = (preset: FieldPreset) => {
        router.delete(route('super-admin.data-import-presets.destroy', preset.id), {
            preserveScroll: true,
            preserveState: true,
            onError: () => toast.error('No se pudo eliminar el preset.'),
        });
    };

    /* --------------------------------------------------------------- carga */

    const maxBytes = maxUploadKb * 1024;

    /** Comprobaciones de cliente; el servidor las repite, esto solo evita el viaje. */
    const aceptarArchivo = (type: string, file: File | null | undefined) => {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            toast.error('Solo archivos .csv');

            return;
        }
        if (file.size > maxBytes) {
            toast.error(`El archivo pesa ${formatBytes(file.size)} y el maximo es ${formatBytes(maxBytes)}.`);

            return;
        }

        setPicked((p) => ({ ...p, [type]: file }));
    };

    const onDrop = (type: string) => (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        setDragOver(null);
        aceptarArchivo(type, e.dataTransfer.files?.[0]);
    };

    const submitImport: (type: string) => FormEventHandler<HTMLFormElement> = (type) => (e) => {
        e.preventDefault();
        if (uploadingType) return;

        const archivo = picked[type];
        if (!archivo) {
            toast.error('Elige o arrastra un archivo CSV primero.');

            return;
        }

        const form = e.currentTarget;
        const fd = new FormData(form);
        // El archivo puede venir de arrastrarlo, y eso no llena el input: se inyecta.
        fd.set('file', archivo);
        fd.set('type', type);

        setUploadingType(type);
        router.post(route('super-admin.data-imports.store'), fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setPicked((p) => ({ ...p, [type]: null }));
            },
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
        if (processingBatchId !== null) return;

        setProcessingBatchId(batchId);
        router.post(route('super-admin.data-imports.process', batchId), {}, {
            preserveScroll: true,
            onFinish: () => setProcessingBatchId(null),
        });
    };

    /* -------------------------------------------------------- estado fila */

    const lastOf = (type: string): LatestBatch | null => latestByType?.[type] ?? null;

    /**
     * Que mostrar en la columna «Estado». Mientras no haya lote, refleja el formulario;
     * despues, en que quedo la ultima importacion de esa entidad.
     */
    const rowState = (type: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; hint?: string } => {
        if (uploadingType === type) return { label: 'Subiendo…', variant: 'warning' };

        const ultimo = lastOf(type);

        if (ultimo && processingBatchId === ultimo.id) return { label: 'Procesando…', variant: 'warning' };

        if (picked[type]) {
            const f = picked[type] as File;

            return { label: 'Archivo listo', variant: 'neutral', hint: `${f.name} · ${formatBytes(f.size)}` };
        }

        if (!ultimo) return { label: 'Sin archivo', variant: 'neutral' };

        const detalle = (u: LatestBatch) => `${u.original_filename} · ${new Date(u.created_at).toLocaleDateString()}`;

        if (ultimo.status === 'completed') {
            return ultimo.rows_failed > 0
                ? { label: `Importado con ${ultimo.rows_failed} ${ultimo.rows_failed === 1 ? 'error' : 'errores'}`, variant: 'warning', hint: detalle(ultimo) }
                : { label: `Importado · ${ultimo.rows_success} filas`, variant: 'success', hint: detalle(ultimo) };
        }
        if (ultimo.status === 'pending') {
            const filas = ultimo.meta && typeof ultimo.meta.rows_detected === 'number' ? ultimo.meta.rows_detected : null;

            return {
                label: 'Listo para procesar',
                variant: 'neutral',
                hint: filas !== null ? `${ultimo.original_filename} · ${filas} filas` : detalle(ultimo),
            };
        }
        if (ultimo.status === 'processing') return { label: 'Procesando…', variant: 'warning', hint: detalle(ultimo) };

        const fatal = ultimo.meta && typeof ultimo.meta.fatal_error === 'string' ? ultimo.meta.fatal_error : undefined;

        return { label: 'Fallido', variant: 'danger', hint: fatal ?? detalle(ultimo) };
    };

    /* ------------------------------------------------------- estado movil */

    /**
     * Un paso cuenta como cumplido cuando su ultima importacion termino. De aqui sale
     * cual es la entidad accionable y cuales se muestran en espera.
     */
    const pasoCumplido = (key: string): boolean => lastOf(key)?.status === 'completed';

    /** Primer paso de la lista que aun no se ha importado; es el que se destaca. */
    const indiceAccionable = TYPE_KEYS.findIndex((key) => !pasoCumplido(key));

    type EstadoTarjeta = 'importado' | 'errores' | 'listo' | 'listo-local' | 'sin-archivo' | 'en-espera' | 'procesando' | 'subiendo' | 'fallido';

    /**
     * En que esta cada entidad. En movil decide que se dibuja: la tarjeta solo muestra
     * los controles que aplican a su estado, en vez de repetirlos las seis veces.
     */
    const estadoTarjeta = (key: TypeKey, indice: number): EstadoTarjeta => {
        if (uploadingType === key) return 'subiendo';

        const ultimo = lastOf(key);
        if (ultimo && processingBatchId === ultimo.id) return 'procesando';
        if (picked[key]) return 'listo-local';

        if (ultimo) {
            if (ultimo.status === 'pending') return 'listo';
            if (ultimo.status === 'processing') return 'procesando';
            if (ultimo.status === 'failed') return 'fallido';

            return ultimo.rows_failed > 0 ? 'errores' : 'importado';
        }

        // Sin lote: en espera si algun paso anterior no se ha importado. Es solo un aviso
        // visual; al tocar la tarjeta se despliega y se puede cargar igual, porque los
        // datos pueden existir ya en la base sin haber pasado por aqui.
        return indice > 0 && indice > indiceAccionable && !expandidas.includes(key) ? 'en-espera' : 'sin-archivo';
    };

    /** Paso del que se esta esperando; solo tiene sentido en «en-espera». */
    const pasoQueFalta = (indice: number): number =>
        TYPE_KEYS.slice(0, indice).findIndex((key) => !pasoCumplido(key)) + 1;

    const horaDe = (iso: string): string =>
        new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    /** El unico indicador de estado de la tarjeta, arriba a la derecha. */
    const indicador = (key: TypeKey, indice: number): { texto: string; clase: string } => {
        const estado = estadoTarjeta(key, indice);
        const ultimo = lastOf(key);

        switch (estado) {
            case 'importado':
                return { texto: `${ultimo?.rows_success ?? 0} OK`, clase: 'text-emerald-600 dark:text-emerald-400' };
            case 'errores':
                return {
                    texto: `${ultimo?.rows_failed ?? 0} ${ultimo?.rows_failed === 1 ? 'error' : 'errores'}`,
                    clase: 'text-amber-600 dark:text-amber-400',
                };
            case 'listo':
            case 'listo-local':
                return { texto: 'Listo', clase: 'text-indigo-600 dark:text-indigo-400' };
            case 'procesando':
                return { texto: 'Procesando', clase: 'text-indigo-600 dark:text-indigo-400' };
            case 'subiendo':
                return { texto: 'Subiendo', clase: 'text-indigo-600 dark:text-indigo-400' };
            case 'fallido':
                return { texto: 'Fallido', clase: 'text-rose-600 dark:text-rose-400' };
            case 'en-espera':
                return { texto: `Tras el paso ${pasoQueFalta(indice)}`, clase: 'text-slate-400 dark:text-slate-500' };
            default:
                return { texto: 'Sin archivo', clase: 'text-slate-400 dark:text-slate-500' };
        }
    };

    /** Linea de contexto: una sola, y sin repetir lo que ya dice el indicador. */
    const contexto = (key: TypeKey, indice: number): string => {
        const estado = estadoTarjeta(key, indice);
        const ultimo = lastOf(key);

        if (estado === 'importado' && ultimo) return `${ultimo.original_filename} · importado ${horaDe(ultimo.created_at)}`;
        if (estado === 'errores' && ultimo) return `${ultimo.rows_success} filas importadas · ${ultimo.rows_failed} rechazadas`;
        if (estado === 'fallido' && ultimo) {
            return typeof ultimo.meta?.fatal_error === 'string' ? ultimo.meta.fatal_error : 'La importacion no pudo completarse.';
        }

        return DEPENDS[key];
    };

    /** Chip del archivo aun sin procesar; no aparece en ningun otro estado. */
    const chipArchivo = (key: TypeKey, indice: number): string | null => {
        const estado = estadoTarjeta(key, indice);

        if (estado === 'listo-local') {
            const f = picked[key] as File;

            return `${f.name} · ${formatBytes(f.size)}`;
        }

        if (estado === 'listo') {
            const ultimo = lastOf(key);
            if (!ultimo) return null;
            const filas = typeof ultimo.meta?.rows_detected === 'number' ? ultimo.meta.rows_detected : null;

            return filas !== null ? `${ultimo.original_filename} · ${filas} filas` : ultimo.original_filename;
        }

        return null;
    };

    /* ------------------------------------------------------------ historial */

    const filtrosActuales = useMemo(
        () => ({ q: filters?.q ?? '', estado: filters?.estado ?? 'todos', tipo: filters?.tipo ?? '' }),
        [filters],
    );

    const pedirHistorial = (cambios: Partial<Filters>) => {
        router.get(
            route('super-admin.data-imports.index'),
            { ...filtrosActuales, ...cambios },
            { preserveState: true, preserveScroll: true, replace: true, only: ['batches', 'filters'] },
        );
    };

    // Buscador con espera: no se lanza una peticion por tecla.
    useEffect(() => {
        if (primeraCarga.current) {
            primeraCarga.current = false;

            return;
        }
        if (q === filtrosActuales.q) return;

        const t = setTimeout(() => pedirHistorial({ q }), 300);

        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    /* -------------------------------------------------------- vista previa */

    const closePreview = () => {
        setPreviewOpen(false);
        setPreviewData(null);
        setPreviewBatchId(null);
        router.get(
            route('super-admin.data-imports.index'),
            { ...filtrosActuales, page: batches.current_page ?? 1 },
            { preserveState: true, preserveScroll: true, replace: true, only: ['csvPreview', 'csvPreviewError'] },
        );
    };

    useEffect(() => {
        if (csvPreviewError) {
            toast.error(csvPreviewError);
            setPreviewLoading(false);
            setPreviewOpen(false);
            setPreviewData(null);
            setPreviewBatchId(null);

            return;
        }
        if (csvPreview) {
            setPreviewData(csvPreview);
            setPreviewBatchId(csvPreview.batch_id);
            setPreviewOpen(true);
            setPreviewLoading(false);
        }
    }, [csvPreview, csvPreviewError]);

    const openPreview = (batch: DataImportBatch) => {
        if (previewLoading) return;

        setPreviewBatchId(batch.id);
        setPreviewOpen(true);
        setPreviewData(null);
        setPreviewLoading(true);
        router.get(
            route('super-admin.data-imports.index'),
            { ...filtrosActuales, preview: batch.id, page: batches.current_page ?? 1 },
            {
                preserveState: true,
                preserveScroll: true,
                only: ['csvPreview', 'csvPreviewError'],
                onFinish: () => setPreviewLoading(false),
            },
        );
    };

    const handleDelete = () => {
        if (!confirmDelete || deletingBatchId !== null) return;

        const id = confirmDelete.id;
        setDeletingBatchId(id);
        router.delete(route('super-admin.data-imports.destroy', id), {
            preserveScroll: true,
            onSuccess: () => setConfirmDelete(null),
            onFinish: () => setDeletingBatchId(null),
        });
    };

    /* ----------------------------------------------------------- fragmentos */

    const chipFormato = (texto: string) => (
        <span
            key={texto}
            className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
            {texto}
        </span>
    );

    /** Opciones propias de un tipo; van dentro del form de su fila. */
    const opcionesDelTipo = (key: string) => {
        if (key === 'companies') {
            return (
                <label className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Si el NIT ya existe
                    <select
                        name="company_import_mode"
                        defaultValue="skip"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                        <option value="skip">Omitir fila</option>
                        <option value="update">Actualizar empresa</option>
                    </select>
                </label>
            );
        }

        if (key === 'employees_users') {
            return (
                <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <input
                        type="checkbox"
                        name="employee_update_existing"
                        value="1"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    Actualizar empleado si ya existe (mismo documento en la empresa)
                </label>
            );
        }

        return null;
    };

    const filaEntidad = (key: TypeKey, indice: number) => {
        const archivo = picked[key] ?? null;
        const ultimo = lastOf(key);
        const estado = rowState(key);
        const total = fieldsOf(key).length;
        const elegidos = effectiveCount(key);
        const subiendo = uploadingType === key;
        const procesando = ultimo !== null && processingBatchId === ultimo.id;

        return (
            <form
                key={key}
                onSubmit={submitImport(key)}
                className="lg:border-b lg:border-slate-200 lg:p-4 lg:last:border-b-0 dark:lg:border-slate-700"
            >
                {/*
                  * Un solo input por entidad, fuera de las dos vistas: en escritorio lo
                  * dispara el area de arrastre y en movil el boton «Subir CSV».
                  * Sin `required`: un archivo soltado encima no lo llena, y la
                  * comprobacion la hace submitImport antes de enviar.
                  */}
                <input
                    id={`file-${key}`}
                    type="file"
                    name="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={(e) => {
                        aceptarArchivo(key, e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />

                <div className="lg:hidden">{tarjetaEntidad(key, indice)}</div>

                <div className="hidden gap-3 lg:grid lg:grid-cols-12 lg:items-start">
                    {/* Entidad */}
                    <div className="lg:col-span-3">
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                {indice + 1}
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{types[key] ?? key}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{DEPENDS[key]}</p>
                            </div>
                        </div>
                    </div>

                    {/* Plantilla */}
                    <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
                        <a
                            href={templateHref(key)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Descargar CSV
                        </a>
                        <button
                            type="button"
                            onClick={() => setFieldPickerType(key)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                            Campos {elegidos}/{total}
                        </button>
                    </div>

                    {/* Archivo */}
                    <div className="space-y-2 lg:col-span-4">
                        <label
                            htmlFor={`file-${key}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(key);
                            }}
                            onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
                            onDrop={onDrop(key)}
                            className={cn(
                                'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors',
                                dragOver === key
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                                    : 'border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400',
                            )}
                        >
                            {archivo ? (
                                <>
                                    <DocumentTextIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={archivo.name}>
                                        {archivo.name}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(archivo.size)}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPicked((p) => ({ ...p, [key]: null }));
                                        }}
                                        aria-label="Quitar archivo"
                                        className="shrink-0 rounded p-1 text-slate-400 hover:text-rose-500"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <ArrowUpTrayIcon className="h-4 w-4 shrink-0" />
                                    <span>Arrastra el CSV o pulsa para elegirlo</span>
                                </>
                            )}
                        </label>
                        {opcionesDelTipo(key)}
                    </div>

                    {/* Estado */}
                    <div className="lg:col-span-2">
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                        {estado.hint ? (
                            <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400" title={estado.hint}>
                                {estado.hint}
                            </p>
                        ) : null}
                        {/*
                          * Barra indeterminada: el procesamiento es sincronico, no hay
                          * porcentaje real que mostrar sin inventarlo.
                          */}
                        {procesando || subiendo ? (
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
                            </div>
                        ) : null}
                    </div>

                    {/* Accion */}
                    <div className="flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
                        {archivo ? (
                            <Button type="submit" size="sm" loading={subiendo} disabled={uploadingType !== null}>
                                {subiendo ? 'Subiendo…' : 'Cargar'}
                            </Button>
                        ) : ultimo && canProcessBatch(ultimo.status) ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="success"
                                loading={procesando}
                                disabled={processingBatchId !== null}
                                onClick={() => runProcess(ultimo.id)}
                            >
                                {procesando ? 'Procesando…' : 'Procesar'}
                            </Button>
                        ) : ultimo ? (
                            <Link
                                href={route('super-admin.data-imports.show', ultimo.id)}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                                Ver detalle
                            </Link>
                        ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                        )}
                    </div>
                </div>
            </form>
        );
    };

    /**
     * Tarjeta de una entidad en movil.
     *
     * A diferencia de la fila de escritorio, no apila todos los controles: cada estado
     * dibuja solo lo suyo. Las plantillas no viven aqui —se abren en su propia hoja—,
     * asi que la tarjeta se lee de un vistazo y nunca compiten dos acciones.
     */
    const tarjetaEntidad = (key: TypeKey, indice: number) => {
        const estado = estadoTarjeta(key, indice);
        const ultimo = lastOf(key);
        const marca = indicador(key, indice);
        const chip = chipArchivo(key, indice);
        const enEspera = estado === 'en-espera';
        const esAccionable = indice === indiceAccionable;
        const importado = estado === 'importado';
        const irAlDetalle = () => ultimo && router.visit(route('super-admin.data-imports.show', ultimo.id));

        const circulo = importado
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : esAccionable && !enEspera
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

        const botonCampos = (fantasma: boolean) => (
            <button
                type="button"
                onClick={() => setFieldPickerType(key)}
                className={cn(
                    'min-h-11 shrink-0 px-3 text-[13px]',
                    fantasma
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'rounded-lg border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
                )}
            >
                {fantasma ? 'Campos' : `Campos ${effectiveCount(key)}/${fieldsOf(key).length}`}
            </button>
        );

        return (
            <div
                key={key}
                data-entidad={key}
                onClick={importado ? irAlDetalle : enEspera ? () => setExpandidas((e) => [...e, key]) : undefined}
                onKeyDown={(e) => {
                    if (!(importado || enEspera) || (e.key !== 'Enter' && e.key !== ' ')) return;
                    e.preventDefault();
                    if (importado) irAlDetalle();
                    else setExpandidas((x) => [...x, key]);
                }}
                role={importado || enEspera ? 'button' : undefined}
                tabIndex={importado || enEspera ? 0 : undefined}
                className={cn(
                    'rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800',
                    (importado || enEspera) && 'cursor-pointer',
                    enEspera && 'opacity-55',
                )}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span
                            className={cn(
                                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                circulo,
                            )}
                        >
                            {importado ? '✓' : indice + 1}
                        </span>
                        <span className="truncate text-[15px] font-medium text-slate-800 dark:text-slate-100">{types[key] ?? key}</span>
                    </div>
                    <span className={cn('shrink-0 text-[12px] font-medium', marca.clase)}>{marca.texto}</span>
                </div>

                <p className="mt-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{contexto(key, indice)}</p>

                {chip ? (
                    <p className="mt-2.5 truncate rounded-md bg-slate-100 px-2 py-1.5 text-[12px] text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {chip}
                    </p>
                ) : null}

                {/*
                  * Las opciones del tipo solo cuando hay archivo elegido y sin subir: van
                  * con la carga, y cambiarlas despues no tendria efecto.
                  */}
                {estado === 'listo-local' && opcionesDelTipo(key) ? <div className="mt-2.5">{opcionesDelTipo(key)}</div> : null}

                {importado || enEspera ? null : (
                    <div className="mt-2.5 flex items-center gap-2">
                        {estado === 'errores' && ultimo ? (
                            <Link
                                href={route('super-admin.data-imports.show', ultimo.id)}
                                className="flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-300 text-[13px] font-medium text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            >
                                Ver errores
                            </Link>
                        ) : estado === 'listo-local' ? (
                            <>
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="min-h-11 flex-1"
                                    loading={uploadingType === key}
                                    disabled={uploadingType !== null}
                                >
                                    Cargar
                                </Button>
                                {botonCampos(false)}
                            </>
                        ) : (estado === 'listo' || estado === 'fallido') && ultimo ? (
                            <>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="success"
                                    className="min-h-11 flex-1"
                                    loading={processingBatchId === ultimo.id}
                                    disabled={processingBatchId !== null}
                                    onClick={() => runProcess(ultimo.id)}
                                >
                                    {estado === 'fallido' ? 'Reintentar' : 'Procesar'}
                                </Button>
                                {estado === 'fallido' ? (
                                    <Link
                                        href={route('super-admin.data-imports.show', ultimo.id)}
                                        className="flex min-h-11 shrink-0 items-center rounded-lg border border-slate-300 px-3 text-[13px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
                                    >
                                        Detalle
                                    </Link>
                                ) : (
                                    botonCampos(false)
                                )}
                            </>
                        ) : estado === 'procesando' || estado === 'subiendo' ? (
                            <Button type="button" size="sm" className="min-h-11 w-full" loading disabled>
                                {estado === 'subiendo' ? 'Subiendo…' : 'Procesando…'}
                            </Button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('file-' + key)?.click()}
                                    className="min-h-11 flex-1 rounded-lg border border-slate-300 text-[13px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                                >
                                    Subir CSV
                                </button>
                                {botonCampos(true)}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    /* --------------------------------------------------------------- render */

    const tipoActivo = fieldPickerType;
    const gruposDelTipo = tipoActivo
        ? Array.from(new Set(optionalOf(tipoActivo).map((f) => groupOf(f.key))))
        : [];
    const filtroCampos = fieldQuery.trim().toLowerCase();
    const camposVisibles = tipoActivo
        ? optionalOf(tipoActivo).filter(
              (f) =>
                  filtroCampos === '' ||
                  f.key.toLowerCase().includes(filtroCampos) ||
                  (f.help ?? '').toLowerCase().includes(filtroCampos),
          )
        : [];

    return (
        <AppLayout title="Importacion CSV">
            <Head title="Importacion masiva (CSV)" />
            <div className="space-y-6">
                <PageHeader
                    title="Importacion masiva (CSV)"
                    description="Sigue el orden: cada paso necesita el anterior."
                    action={
                        <Button type="button" variant="secondary" size="sm" className="min-h-11 lg:min-h-9" onClick={() => setPlantillasAbierto(true)}>
                            <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />
                            Plantillas
                        </Button>
                    }
                />

                {/* Formato y orden */}
                {/* En movil esto vive en la hoja de plantillas: la lista numerada ya dice el orden. */}
                <section className="hidden gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid lg:grid-cols-2 dark:border-slate-700 dark:bg-slate-800">
                    <div>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Formato del archivo
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {['UTF-8', 'Separador: coma', 'snake_case', 'YYYY-MM-DD', `Máx. ${formatBytes(maxBytes)}`].map(chipFormato)}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Orden obligatorio
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-y-1.5">
                            {TYPE_KEYS.map((key, i) => (
                                // El chip y su flecha van juntos para que la flecha nunca
                                // quede sola al final de una linea.
                                <span key={key} className="inline-flex items-center">
                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        {i + 1} {types[key] ?? key}
                                    </span>
                                    {i < TYPE_KEYS.length - 1 ? <span className="px-1 text-slate-400">→</span> : null}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Entidades */}
                <section className="space-y-2.5 lg:space-y-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm dark:lg:border-slate-700 dark:lg:bg-slate-800">
                    <div className="hidden flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 lg:flex dark:border-slate-700">
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Entidades</h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Las plantillas y el paquete ZIP estan en «Plantillas».</span>
                    </div>

                    {/* Cabecera solo en escritorio; en movil cada tarjeta se lee sola. */}
                    <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 lg:grid dark:border-slate-700 dark:text-slate-400">
                        <span className="col-span-3">Entidad</span>
                        <span className="col-span-2">Plantilla</span>
                        <span className="col-span-4">Archivo</span>
                        <span className="col-span-2">Estado</span>
                        <span className="col-span-1 text-right">Acción</span>
                    </div>

                    {TYPE_KEYS.map((key, i) => filaEntidad(key, i))}
                </section>

                {/* Historial */}
                <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Historial</h2>
                        {/* En movil no se lista de entrada: se abre a peticion. */}
                        <button
                            type="button"
                            onClick={() => setHistorialAbierto((v) => !v)}
                            className="min-h-11 text-[13px] font-medium text-indigo-600 lg:hidden dark:text-indigo-400"
                        >
                            {historialAbierto ? 'Ocultar historial' : 'Ver historial'}
                        </button>
                        <div className={cn('flex-wrap items-center gap-2 lg:flex', historialAbierto ? 'flex w-full' : 'hidden')}>
                            <div className="relative">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Archivo o usuario…"
                                    className="h-9 w-52 rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                />
                            </div>
                            <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
                                {([
                                    ['todos', 'Todos'],
                                    ['errores', 'Con errores'],
                                    ['pendientes', 'Pendientes'],
                                ] as const).map(([valor, etiqueta]) => (
                                    <button
                                        key={valor}
                                        type="button"
                                        onClick={() => pedirHistorial({ estado: valor })}
                                        className={cn(
                                            'h-9 px-3 text-xs',
                                            filtrosActuales.estado === valor
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700',
                                        )}
                                    >
                                        {etiqueta}
                                    </button>
                                ))}
                            </div>
                            <select
                                value={filtrosActuales.tipo}
                                onChange={(e) => pedirHistorial({ tipo: e.target.value })}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            >
                                <option value="">Todas las entidades</option>
                                {TYPE_KEYS.map((key) => (
                                    <option key={key} value={key}>
                                        {types[key] ?? key}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={cn('space-y-3 lg:block', historialAbierto ? 'block' : 'hidden')}>
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
                                        No hay importaciones que coincidan con el filtro.
                                    </td>
                                </tr>
                            ) : (
                                batches.data.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell data-label="Fecha" className="whitespace-nowrap text-sm">
                                            {new Date(b.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell data-label="Usuario" className="text-sm">
                                            {b.user ? `${b.user.name} ${b.user.last_name ?? ''}`.trim() : `ID ${b.user_id}`}
                                        </TableCell>
                                        <TableCell data-label="Tipo" className="text-sm">
                                            {types[b.type] ?? b.type}
                                        </TableCell>
                                        <TableCell data-label="Archivo" className="max-w-[12rem] truncate text-sm" title={b.original_filename}>
                                            {b.original_filename}
                                        </TableCell>
                                        <TableCell data-label="Estado" align="center">
                                            <Badge variant={statusVariant(b.status)}>{statusLabel(b.status)}</Badge>
                                        </TableCell>
                                        <TableCell data-label="OK / Error" align="center" className="text-sm tabular-nums">
                                            {b.rows_success} / {b.rows_failed}
                                        </TableCell>
                                        <TableCell data-label="Acciones" align="right">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    loading={previewLoading && previewBatchId === b.id}
                                                    disabled={previewLoading}
                                                    onClick={() => openPreview(b)}
                                                >
                                                    <EyeIcon className="h-4 w-4" aria-hidden />
                                                    <span className="sr-only sm:not-sr-only sm:ml-1">Vista previa</span>
                                                </Button>
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
                                                {b.rows_failed > 0 ? (
                                                    <a
                                                        href={route('super-admin.data-imports.errors.csv', b.id)}
                                                        className="text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
                                                    >
                                                        Filas con error
                                                    </a>
                                                ) : null}
                                                <Link
                                                    href={route('super-admin.data-imports.show', b.id)}
                                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                                >
                                                    Ver detalle
                                                </Link>
                                                {canDeleteBatch(b.status) ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        loading={deletingBatchId === b.id}
                                                        disabled={deletingBatchId !== null}
                                                        onClick={() => setConfirmDelete(b)}
                                                        aria-label="Eliminar importacion"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-rose-500" aria-hidden />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <Pagination links={batches.links} from={batches.from} to={batches.to} total={batches.total} />
                    </div>
                </section>
            </div>

            {/*
              * Hoja de plantillas: el unico acceso a las descargas en movil, para que la
              * lista de entidades no repita «Descargar CSV» y «Campos» seis veces.
              */}
            <Modal
                open={plantillasAbierto}
                onClose={() => setPlantillasAbierto(false)}
                sheetOnMobile
                size="lg"
                title="Plantillas"
                description="Descarga la de cada entidad, o el paquete completo."
                footer={
                    <a
                        href={zipHref()}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100 sm:min-h-9 sm:w-auto dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Paquete ZIP + LEEME
                    </a>
                }
            >
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                        {['UTF-8', 'Separador: coma', 'snake_case', 'YYYY-MM-DD', `Máx. ${formatBytes(maxBytes)}`].map(chipFormato)}
                    </div>

                    <div className="space-y-2">
                        {TYPE_KEYS.map((key, i) => (
                            <div
                                key={key}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                        {i + 1}
                                    </span>
                                    <span className="truncate text-sm text-slate-800 dark:text-slate-100">{types[key] ?? key}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPlantillasAbierto(false);
                                            setFieldPickerType(key);
                                        }}
                                        className="min-h-11 rounded-lg px-2 text-[12px] text-indigo-600 sm:min-h-9 dark:text-indigo-400"
                                    >
                                        Campos {effectiveCount(key)}/{fieldsOf(key).length}
                                    </button>
                                    <a
                                        href={templateHref(key)}
                                        aria-label={`Descargar plantilla de ${types[key] ?? key}`}
                                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 sm:min-h-9 sm:min-w-9 dark:border-slate-600"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Vista previa del CSV */}
            <Modal
                open={previewOpen}
                onClose={closePreview}
                title={previewData ? `Vista previa · ${previewData.filename}` : 'Vista previa'}
                description={
                    previewData
                        ? `${previewData.total_data_rows} filas de datos${previewData.truncated ? ' (se muestran las primeras)' : ''}`
                        : undefined
                }
                size="4xl"
            >
                {previewLoading ? (
                    <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
                ) : previewData ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    {previewData.headers.map((h) => (
                                        <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {previewData.rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => (
                                            <td key={j} className="whitespace-nowrap px-2 py-1 text-slate-700 dark:text-slate-300">
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </Modal>

            {/* Selector de campos de la plantilla */}
            <Modal
                open={tipoActivo !== null}
                onClose={() => {
                    setFieldPickerType(null);
                    setFieldQuery('');
                }}
                sheetOnMobile
                size="2xl"
                title={`Campos de ${tipoActivo ? (types[tipoActivo] ?? tipoActivo) : ''}`}
                description={
                    tipoActivo
                        ? `${effectiveCount(tipoActivo)} de ${fieldsOf(tipoActivo).length} campos · ${requiredOf(tipoActivo).length} obligatorios fijos`
                        : undefined
                }
                footer={
                    tipoActivo ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 sm:min-h-9"
                                onClick={() => {
                                    setPresetName('');
                                    setPresetShared(false);
                                    setSavePresetFor(tipoActivo);
                                }}
                            >
                                Guardar preset
                            </Button>
                            <a
                                href={templateHref(tipoActivo)}
                                onClick={() => {
                                    setFieldPickerType(null);
                                    setFieldQuery('');
                                }}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 sm:min-h-9 sm:w-auto"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Descargar plantilla · {effectiveCount(tipoActivo)} campos
                            </a>
                        </div>
                    ) : null
                }
            >
                {tipoActivo ? (
                    <div className="space-y-4">
                        {/* Obligatorios: franja fija, no casillas apagadas que confunden. */}
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                Siempre incluidos
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {requiredOf(tipoActivo).map((f) => (
                                    <span
                                        key={f.key}
                                        title={f.help ?? undefined}
                                        className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                    >
                                        {f.key}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Presets */}
                        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                            {(['Mínimo', 'Recomendado', 'Completo'] as const).map((nombre) => (
                                <button
                                    key={nombre}
                                    type="button"
                                    onClick={() => aplicarPreset(tipoActivo, nombre)}
                                    className={cn(
                                        'shrink-0 rounded-full border px-3 py-1.5 text-xs',
                                        activePreset[tipoActivo] === nombre
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200'
                                            : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
                                    )}
                                >
                                    {nombre}
                                </button>
                            ))}
                            {presetsOf(tipoActivo).map((preset) => (
                                <span
                                    key={preset.id}
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-1 rounded-full border py-1.5 pl-3 pr-1.5 text-xs',
                                        activePreset[tipoActivo] === preset.name
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200'
                                            : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
                                    )}
                                >
                                    <button type="button" onClick={() => aplicarPresetGuardado(tipoActivo, preset)}>
                                        {preset.name}
                                        {preset.is_shared ? ' · compartido' : ''}
                                    </button>
                                    {preset.is_own ? (
                                        <button
                                            type="button"
                                            onClick={() => borrarPreset(preset)}
                                            aria-label={`Eliminar preset ${preset.name}`}
                                            className="rounded-full p-0.5 text-slate-400 hover:text-rose-500"
                                        >
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}
                                </span>
                            ))}
                            {activePreset[tipoActivo] === 'Personalizado' ? (
                                <span className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-600">
                                    Personalizado
                                </span>
                            ) : null}
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={fieldQuery}
                                onChange={(e) => setFieldQuery(e.target.value)}
                                placeholder="Buscar campo…"
                                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 sm:h-9 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            />
                        </div>

                        {/* Opcionales, por grupo */}
                        {camposVisibles.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-500">
                                {optionalOf(tipoActivo).length === 0
                                    ? 'Esta plantilla no tiene campos opcionales: todos son obligatorios.'
                                    : 'Ningun campo coincide con la busqueda.'}
                            </p>
                        ) : (
                            gruposDelTipo.map((grupo) => {
                                const delGrupo = camposVisibles.filter((f) => groupOf(f.key) === grupo);
                                if (delGrupo.length === 0) return null;

                                const marcados = delGrupo.filter((f) => chosenOf(tipoActivo).includes(f.key)).length;
                                const todosMarcados = marcados === delGrupo.length;

                                return (
                                    <div key={grupo}>
                                        <div className="flex items-center justify-between gap-2 pb-1.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                {grupo} <span className="font-normal">({marcados}/{delGrupo.length})</span>
                                            </p>
                                            {/*
                                              * Solo si el grupo tiene opcionales; si no, seria
                                              * un boton que no hace nada.
                                              */}
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(tipoActivo, grupo, !todosMarcados)}
                                                className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                            >
                                                {todosMarcados ? 'Quitar grupo' : 'Añadir grupo'}
                                            </button>
                                        </div>
                                        <div className="grid gap-1.5 sm:grid-cols-2">
                                            {delGrupo.map((field) => {
                                                const marcado = chosenOf(tipoActivo).includes(field.key);

                                                return (
                                                    <label
                                                        key={field.key}
                                                        className={cn(
                                                            'flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs',
                                                            marcado
                                                                ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40'
                                                                : 'border-slate-200 dark:border-slate-700',
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={marcado}
                                                            onChange={() => toggleField(tipoActivo, field.key)}
                                                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600"
                                                        />
                                                        <span className="min-w-0">
                                                            <code className="font-medium text-slate-800 dark:text-slate-100">{field.key}</code>
                                                            {field.help ? (
                                                                <span className="mt-0.5 block text-slate-500 dark:text-slate-400">{field.help}</span>
                                                            ) : null}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : null}
            </Modal>

            {/* Guardar preset */}
            <Modal
                open={savePresetFor !== null}
                onClose={() => setSavePresetFor(null)}
                title="Guardar seleccion de campos"
                description="Con el mismo nombre se sobrescribe el preset anterior."
                size="sm"
                footer={
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSavePresetFor(null)}>
                            Cancelar
                        </Button>
                        <Button type="button" size="sm" loading={savingPreset} onClick={guardarPreset}>
                            Guardar
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <label className="block text-xs text-slate-600 dark:text-slate-300">
                        Nombre
                        <input
                            type="text"
                            value={presetName}
                            maxLength={60}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Ej. Nomina basica"
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                    </label>
                    <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={presetShared}
                            onChange={(e) => setPresetShared(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        Compartirlo con los demas super usuarios
                    </label>
                    {savePresetFor ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Se guardaran {effectiveCount(savePresetFor)} campos de «{types[savePresetFor] ?? savePresetFor}».
                        </p>
                    ) : null}
                </div>
            </Modal>

            <ConfirmDialog
                open={confirmDelete !== null}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar importacion"
                message={
                    confirmDelete
                        ? `Se eliminara el registro de «${confirmDelete.original_filename}» junto con su archivo y su reporte de errores. Los datos ya importados no se revierten.`
                        : ''
                }
                confirmText="Eliminar"
                variant="danger"
                loading={deletingBatchId !== null}
            />
        </AppLayout>
    );
}
