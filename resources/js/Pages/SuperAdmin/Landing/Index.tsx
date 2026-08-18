import { Head, router } from '@inertiajs/react';
import {
    ArrowCounterClockwise,
    ArrowDown,
    ArrowUp,
    ClockCounterClockwise,
    Copy,
    Desktop,
    DeviceMobile,
    DotsSixVertical,
    Eye,
    EyeSlash,
    Image as ImageIcon,
    Needle,
    Plus,
    Trash,
    X,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    AudienceBlock,
    BandBlock,
    ClosingBlock,
    FlowBlock,
    HeroBlock,
    QuoteBlock,
    StepsMediaBlock,
    VirtuesBlock,
} from '@/Components/Public/Blocks';
import { BlockShell } from '@/Components/Public/BlockShell';
import { PALETTE_SWATCHES, resolveAppearance } from '@/Components/Public/appearance';
import { DataBlock } from '@/Components/Public/DataBlock';
import { phosphorIcon } from '@/Components/Public/phosphorIcon';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { ConfirmDialog } from '@/Components/UI/ConfirmDialog';
import { Input } from '@/Components/UI/Input';
import { Modal } from '@/Components/UI/Modal';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { summarize } from '@/Pages/SuperAdmin/Landing/summarize';
import '../../../../css/public.css';

type Dict = Record<string, unknown>;

interface BlockRow {
    id: number;
    type: string;
    position: number;
    is_visible: boolean;
    data: Dict;
    is_dirty: boolean;
    /** Solo en bloques de datos: filas ya resueltas por el servidor y su posible error. */
    rows?: Dict[];
    error?: string | null;
}

interface Option {
    value: string | number;
    label: string;
}

interface FieldSchema {
    type: string;
    label: string;
    max?: number;
    /** Solo en campos `range`: extremos y salto del control. */
    min?: number;
    step?: number;
    unit?: string;
    rows?: number;
    max_items?: number;
    singular?: string;
    help?: string;
    /** Opciones fijas del catalogo. */
    options?: Option[];
    /** Nombre de una lista que sirve el servidor (empresas, origenes de datos…). */
    options_from?: string;
    /** El campo solo se pinta si otro campo tiene cierto valor (o uno de una lista). */
    show_if?: { field: string; value: string | string[] };
    item?: Record<string, FieldSchema>;
}

interface CatalogEntry {
    label: string;
    icon: string;
    singleton: boolean;
    fields: Record<string, FieldSchema>;
    /** Apariencia por defecto del tipo; `false` en los que dibujan su propio marco. */
    appearance?: Record<string, unknown> | false;
}

/** Grupo de la pestaña «Diseño» (config/landing_appearance.php). */
interface AppearanceGroup {
    label: string;
    icon: string;
    help?: string;
    fields: Record<string, FieldSchema>;
}

interface Props {
    blocks: BlockRow[];
    catalog: Record<string, CatalogEntry>;
    /** Tamaño, fondo y animación: mismos ajustes para todos los tipos de bloque. */
    appearanceSchema: Record<string, AppearanceGroup>;
    icons: string[];
    linkTargets: { label: string; url: string }[];
    /** Listas para los selectores que dependen de datos: empresas, origenes… */
    fieldOptions: Record<string, Option[]>;
    /** Límite y formatos que acepta la subida de imágenes. */
    media: { max_kb: number; accept: string };
    dirtyCount: number;
    lastPublished: { id: number; published_at: string } | null;
}

interface VersionRow {
    id: number;
    published_at: string | null;
    published_by: string | null;
    blocks: number;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/**
 * Un bloque sin contenido llega como `[]` (arreglo) y no como `{}`. Si se deja asi, las
 * claves que escriba el editor se pierden al serializar. Se normaliza al entrar.
 */
const normalizeBlocks = (rows: BlockRow[]): BlockRow[] =>
    rows.map((r) => (Array.isArray(r.data) ? { ...r, data: {} } : r));

export default function LandingAdminIndex({
    blocks,
    catalog,
    appearanceSchema,
    icons,
    linkTargets,
    fieldOptions,
    media,
    dirtyCount,
}: Props) {
    const [rows, setRows] = useState<BlockRow[]>(normalizeBlocks(blocks));
    const [activeId, setActiveId] = useState<number | null>(blocks[0]?.id ?? null);
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [tab, setTab] = useState<'blocks' | 'preview' | 'fields'>('blocks');
    // El panel derecho separa lo que dice el bloque de cómo se ve.
    const [panel, setPanel] = useState<'content' | 'design'>('content');
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [versions, setVersions] = useState<VersionRow[]>([]);
    const [confirmPublish, setConfirmPublish] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<BlockRow | null>(null);
    const [confirmRestore, setConfirmRestore] = useState<VersionRow | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timer = useRef<number | null>(null);
    const dragFrom = useRef<number | null>(null);

    /**
     * Sincroniza con el servidor sin pisar lo que se esta escribiendo.
     *
     * El autoguardado responde con las props recargadas; si se repusiera el estado local
     * tal cual, una respuesta en vuelo borraria el campo recien tecleado. Por eso, cuando
     * la lista de bloques es la misma, se conserva el contenido local y solo se toman del
     * servidor los datos derivados: si esta sucio y las filas ya resueltas del origen.
     */
    useEffect(() => {
        setRows((prev) => {
            const mismaLista =
                prev.length === blocks.length && prev.every((r, i) => r.id === blocks[i].id);

            if (! mismaLista) {
                return normalizeBlocks(blocks);
            }

            return prev.map((r, i) => ({
                ...r,
                is_dirty: blocks[i].is_dirty,
                rows: blocks[i].rows,
                error: blocks[i].error,
            }));
        });
    }, [blocks]);

    const active = rows.find((r) => r.id === activeId) ?? null;
    const schema = active ? catalog[active.type] : null;
    const localDirty = useMemo(() => rows.filter((r) => r.is_dirty).length || dirtyCount, [rows, dirtyCount]);

    /* -------------------------------------------------------- guardado */

    const save = (id: number, data: Dict, isVisible: boolean) => {
        if (timer.current) window.clearTimeout(timer.current);
        setSaving(true);
        timer.current = window.setTimeout(() => {
            router.put(
                route('super-admin.landing.blocks.update', id),
                { data, is_visible: isVisible } as never,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setErrors({});
                        setSavedAt(Date.now());
                    },
                    onError: (e) => setErrors(e as Record<string, string>),
                    onFinish: () => setSaving(false),
                },
            );
        }, 600);
    };

    const patchActive = (mutate: (d: Dict) => Dict) => {
        if (!active) return;
        const next = mutate(structuredClone(active.data ?? {}));
        setRows((prev) => prev.map((r) => (r.id === active.id ? { ...r, data: next, is_dirty: true } : r)));
        save(active.id, next, active.is_visible);
    };

    const toggleVisible = (row: BlockRow) => {
        const next = !row.is_visible;
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_visible: next } : r)));
        router.put(
            route('super-admin.landing.blocks.update', row.id),
            { data: row.data, is_visible: next } as never,
            { preserveScroll: true, preserveState: true },
        );
    };

    const persistOrder = (next: BlockRow[]) => {
        setRows(next);
        router.put(
            route('super-admin.landing.blocks.reorder'),
            { ids: next.map((r) => r.id) } as never,
            { preserveScroll: true, preserveState: true },
        );
    };

    const moveBy = (id: number, delta: number) => {
        const i = rows.findIndex((r) => r.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= rows.length) return;
        const next = [...rows];
        [next[i], next[j]] = [next[j], next[i]];
        persistOrder(next);
    };

    const openVersions = () => {
        setVersionsOpen(true);
        fetch(route('super-admin.landing.versions'), { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d) => setVersions(d.versions ?? []))
            .catch(() => toast.error('No se pudieron cargar las versiones.'));
    };

    /* ------------------------------------------------------- controles */

    const errorFor = (path: string) => errors[path];

    /** Un campo con `show_if` solo se pinta cuando aquel del que depende coincide. */
    const cumpleCondicion = (field: FieldSchema, values: Dict): boolean => {
        if (!field.show_if) return true;

        const actual = str(values[field.show_if.field]);
        const esperado = field.show_if.value;

        return Array.isArray(esperado) ? esperado.includes(actual) : actual === esperado;
    };

    /** Apariencia por defecto del tipo; los que traen `false` dibujan su propio marco. */
    const appearanceDefaults = (type: string): Dict | undefined => {
        const d = catalog[type]?.appearance;

        return d && typeof d === 'object' ? (d as Dict) : undefined;
    };

    /**
     * Apariencia efectiva: lo guardado sobre los valores por defecto del tipo. Los
     * controles muestran siempre lo que se aplica, no solo lo que se tocó.
     */
    const appearanceOf = (row: BlockRow): Dict =>
        resolveAppearance(appearanceDefaults(row.type), (row.data ?? {}).appearance) as unknown as Dict;

    /**
     * Firma de los ajustes de animación. Al cambiar cualquiera, la vista previa vuelve
     * a montar la sección y el revelado se ve otra vez sin tener que desplazarse.
     */
    const animSignature = (row: BlockRow): string => {
        const a = appearanceOf(row);

        return [a.anim, a.anim_speed, a.anim_stagger, a.anim_delay, a.anim_once].join('|');
    };

    const IconPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
        const [q, setQ] = useState('');
        const shown = icons.filter((n) => n.includes(q.trim().toLowerCase()));

        return (
            <div>
                <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-indigo-600 dark:border-slate-600 dark:text-indigo-400">
                        {phosphorIcon(value, 18)}
                    </span>
                    <Input containerClassName="!mb-0 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ícono…" />
                </div>
                <div className="scrollbar-thin mt-2 grid max-h-32 grid-cols-7 gap-1 overflow-y-auto">
                    {shown.map((name) => (
                        <button
                            key={name}
                            type="button"
                            title={name}
                            onClick={() => onChange(name)}
                            className={`flex h-10 items-center justify-center rounded-lg border ${
                                name === value
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                            }`}
                        >
                            {phosphorIcon(name, 16)}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const LinkFields = ({ value, onChange, path }: { value: Dict; onChange: (v: Dict) => void; path: string }) => {
        const url = str(value.url);
        const known = linkTargets.some((t) => t.url === url);
        const [custom, setCustom] = useState(!known && url !== '');

        return (
            <div className="grid grid-cols-2 gap-2">
                <Input
                    containerClassName="!mb-0"
                    label="Texto"
                    value={str(value.label)}
                    onChange={(e) => onChange({ ...value, label: e.target.value })}
                    error={errorFor(`${path}.label`)}
                />
                <div>
                    <Select
                        label="Destino"
                        value={custom ? '__custom' : url}
                        onChange={(e) => {
                            if (e.target.value === '__custom') {
                                setCustom(true);
                                return;
                            }
                            setCustom(false);
                            onChange({ ...value, url: e.target.value });
                        }}
                        options={[
                            ...linkTargets.map((t) => ({ value: t.url, label: t.label })),
                            { value: '__custom', label: 'URL personalizada' },
                        ]}
                        placeholder="—"
                    />
                    {custom ? (
                        <Input
                            containerClassName="!mb-0 mt-1.5"
                            value={url}
                            onChange={(e) => onChange({ ...value, url: e.target.value })}
                            placeholder="https://…"
                            error={errorFor(`${path}.url`)}
                        />
                    ) : null}
                </div>
            </div>
        );
    };

    const renderField = (key: string, field: FieldSchema, data: Dict, path: string): React.ReactNode => {
        const value = data[key];
        const setValue = (v: unknown) => patchActive((d) => setDeep(d, path.split('.').slice(1).concat(key), v));

        switch (field.type) {
            case 'textarea':
                return (
                    <Textarea
                        label={field.label}
                        rows={field.rows ?? 3}
                        value={str(value)}
                        onChange={(e) => setValue(e.target.value)}
                        error={errorFor(`${path}.${key}`)}
                        description={field.max ? `${str(value).length}/${field.max}` : undefined}
                    />
                );
            case 'icon':
                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <IconPicker value={str(value)} onChange={setValue} />
                        {errorFor(`${path}.${key}`) ? (
                            <p className="mt-1 text-xs text-rose-500">{errorFor(`${path}.${key}`)}</p>
                        ) : null}
                    </div>
                );
            case 'link':
                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <LinkFields
                            value={(value ?? {}) as Dict}
                            onChange={setValue}
                            path={`${path}.${key}`}
                        />
                    </div>
                );
            case 'image':
                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                            {str(value) ? (
                                <img src={str(value)} alt="" className="h-full w-full rounded-lg object-cover" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <ImageIcon size={22} className="mx-auto" />
                                    <p className="mt-1 text-xs">Sin imagen</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex gap-2">
                            <label className="flex-1">
                                <input
                                    type="file"
                                    accept={media.accept}
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        // Se limpia para poder reintentar el mismo archivo tras un fallo.
                                        e.target.value = '';
                                        if (!file) return;

                                        // Se avisa del peso antes de subir: no tiene sentido mandar
                                        // 12 MB para que el servidor los rechace al final.
                                        if (file.size > media.max_kb * 1024) {
                                            toast.error(
                                                `La imagen pesa ${(file.size / 1048576).toFixed(1)} MB y el máximo es ${Math.round(
                                                    media.max_kb / 1024,
                                                )} MB.`,
                                            );

                                            return;
                                        }

                                        const body = new FormData();
                                        body.append('image', file);

                                        try {
                                            const res = await fetch(route('super-admin.landing.block-media'), {
                                                method: 'POST',
                                                body,
                                                headers: {
                                                    'X-CSRF-TOKEN':
                                                        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                                                    Accept: 'application/json',
                                                },
                                            });

                                            if (!res.ok) {
                                                toast.error(await uploadError(res));

                                                return;
                                            }

                                            const d = await res.json();
                                            setValue(d.url);
                                        } catch {
                                            toast.error('No se pudo contactar el servidor para subir la imagen.');
                                        }
                                    }}
                                />
                                <span className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-sm dark:border-slate-600">
                                    Subir imagen
                                </span>
                            </label>
                            {str(value) ? (
                                <button
                                    type="button"
                                    onClick={() => setValue('')}
                                    className="h-11 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-600"
                                >
                                    Quitar
                                </button>
                            ) : null}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                            Máx. {Math.round(media.max_kb / 1024)} MB · jpg, png, webp, avif o gif.
                            {field.help ? ` ${field.help}` : ''}
                        </p>
                    </div>
                );
            case 'repeater': {
                const items = Array.isArray(value) ? (value as Dict[]) : [];
                const atMax = field.max_items != null && items.length >= field.max_items;

                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <div className="space-y-2">
                            {items.map((item, i) => (
                                <div key={i} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                            <DotsSixVertical size={13} /> {i + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setValue(items.filter((_, j) => j !== i))}
                                            className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-rose-500"
                                            aria-label="Eliminar elemento"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.entries(field.item ?? {}).map(([subKey, sub]) =>
                                            renderSubField(subKey, sub, item, items, i, setValue, `${path}.${key}.${i}`),
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={atMax}
                            onClick={() => setValue([...items, {}])}
                            className="mt-2 flex h-11 items-center gap-1 text-sm text-indigo-600 disabled:opacity-40 dark:text-indigo-400"
                        >
                            <Plus size={14} /> Añadir {field.singular ?? 'elemento'}
                        </button>
                        {errorFor(`${path}.${key}`) ? (
                            <p className="mt-1 text-xs text-rose-500">{errorFor(`${path}.${key}`)}</p>
                        ) : null}
                    </div>
                );
            }
            case 'select': {
                const opciones = field.options ?? fieldOptions[field.options_from ?? ''] ?? [];

                return (
                    <div>
                        <Select
                            label={field.label}
                            value={str(value)}
                            onChange={(e) => setValue(e.target.value)}
                            options={opciones}
                            placeholder="—"
                            error={errorFor(`${path}.${key}`)}
                        />
                        {field.help ? <p className="mt-1 text-[11px] text-slate-500">{field.help}</p> : null}
                    </div>
                );
            }
            case 'multiselect': {
                const opciones = field.options ?? fieldOptions[field.options_from ?? ''] ?? [];
                const marcados = Array.isArray(value) ? (value as (string | number)[]).map(String) : [];

                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                            {opciones.length === 0 ? (
                                <p className="p-2 text-xs text-slate-500">No hay opciones disponibles.</p>
                            ) : (
                                opciones.map((o) => {
                                    const activo = marcados.includes(String(o.value));

                                    return (
                                        <label
                                            key={o.value}
                                            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded"
                                                checked={activo}
                                                onChange={() =>
                                                    setValue(
                                                        activo
                                                            ? marcados.filter((v) => v !== String(o.value))
                                                            : [...marcados, String(o.value)],
                                                    )
                                                }
                                            />
                                            {o.label}
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        {field.help ? <p className="mt-1 text-[11px] text-slate-500">{field.help}</p> : null}
                        {errorFor(`${path}.${key}`) ? (
                            <p className="mt-1 text-xs text-rose-500">{errorFor(`${path}.${key}`)}</p>
                        ) : null}
                    </div>
                );
            }
            case 'sql':
                return (
                    <div>
                        <Textarea
                            label={field.label}
                            rows={4}
                            value={str(value)}
                            onChange={(e) => setValue(e.target.value)}
                            error={errorFor(`${path}.${key}`)}
                            className="font-mono text-[12px]"
                            placeholder="SELECT name FROM companies WHERE is_active = 1"
                        />
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            {field.help}
                        </p>
                    </div>
                );
            case 'toggle': {
                const activo = value === true;

                return (
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                            {field.help ? <p className="mt-0.5 text-[11px] text-slate-500">{field.help}</p> : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => setValue(!activo)}
                            className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${
                                activo ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            aria-pressed={activo}
                            aria-label={field.label}
                        >
                            <span
                                className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all"
                                style={{ left: activo ? 21 : 3 }}
                            />
                        </button>
                    </div>
                );
            }
            case 'range': {
                const min = field.min ?? 0;
                const max = field.max ?? 100;
                const actual = typeof value === 'number' ? value : Number(value) || min;

                return (
                    <div>
                        <div className="mb-1 flex items-baseline justify-between">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                            <span className="text-[11px] tabular-nums text-slate-500">
                                {actual}
                                {field.unit ?? ''}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            step={field.step ?? 1}
                            value={actual}
                            onChange={(e) => setValue(Number(e.target.value))}
                            className="h-11 w-full accent-indigo-600"
                            aria-label={field.label}
                        />
                        {field.help ? <p className="text-[11px] text-slate-500">{field.help}</p> : null}
                    </div>
                );
            }
            case 'color': {
                const actual = str(value);
                const esToken = PALETTE_SWATCHES.some((s) => s.value === actual);

                return (
                    <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {PALETTE_SWATCHES.map((s) => (
                                <button
                                    key={s.value}
                                    type="button"
                                    title={s.label}
                                    onClick={() => setValue(s.value)}
                                    className={`h-9 w-9 rounded-lg border-2 ${
                                        actual === s.value ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    style={{ backgroundColor: s.preview }}
                                    aria-label={s.label}
                                />
                            ))}
                            {/* Color propio: el cuadro punteado abre el selector del sistema. */}
                            <label
                                title="Color propio"
                                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-2 ${
                                    !esToken && actual
                                        ? 'border-indigo-500'
                                        : 'border-dashed border-slate-300 dark:border-slate-600'
                                }`}
                                style={!esToken && actual ? { backgroundColor: actual } : undefined}
                            >
                                <input
                                    type="color"
                                    className="h-0 w-0 opacity-0"
                                    value={!esToken && actual ? actual : '#161826'}
                                    onChange={(e) => setValue(e.target.value)}
                                />
                                {esToken || !actual ? <span className="text-[11px] text-slate-400">+</span> : null}
                            </label>
                        </div>
                        {field.help ? <p className="mt-1 text-[11px] text-slate-500">{field.help}</p> : null}
                        {errorFor(`${path}.${key}`) ? (
                            <p className="mt-1 text-xs text-rose-500">{errorFor(`${path}.${key}`)}</p>
                        ) : null}
                    </div>
                );
            }
            default:
                return (
                    <Input
                        label={field.label}
                        value={str(value)}
                        onChange={(e) => setValue(e.target.value)}
                        error={errorFor(`${path}.${key}`)}
                    />
                );
        }
    };

    /** Subcampo dentro de un repeater; escribe de vuelta el arreglo completo. */
    const renderSubField = (
        subKey: string,
        sub: FieldSchema,
        item: Dict,
        items: Dict[],
        index: number,
        setList: (v: unknown) => void,
        path: string,
    ): React.ReactNode => {
        const write = (v: unknown) => {
            const next = [...items];
            next[index] = { ...item, [subKey]: v };
            setList(next);
        };

        if (sub.type === 'repeater') {
            const nested = Array.isArray(item[subKey]) ? (item[subKey] as Dict[]) : [];
            const atMax = sub.max_items != null && nested.length >= sub.max_items;

            return (
                <div key={subKey}>
                    <p className="mb-1 text-[11px] text-slate-500">{sub.label}</p>
                    {nested.map((n, k) => (
                        <div key={k} className="mb-1 flex items-center gap-1">
                            <Input
                                containerClassName="!mb-0 flex-1"
                                value={str(n.label)}
                                onChange={(e) => {
                                    const copy = [...nested];
                                    copy[k] = { ...n, label: e.target.value };
                                    write(copy);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => write(nested.filter((_, j) => j !== k))}
                                className="flex h-11 w-11 items-center justify-center text-slate-400"
                                aria-label="Eliminar"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        disabled={atMax}
                        onClick={() => write([...nested, {}])}
                        className="flex h-11 items-center gap-1 text-xs text-indigo-600 disabled:opacity-40 dark:text-indigo-400"
                    >
                        <Plus size={13} /> Añadir {sub.singular ?? 'punto'}
                    </button>
                </div>
            );
        }

        if (sub.type === 'icon') {
            return (
                <div key={subKey}>
                    <p className="mb-1 text-[11px] text-slate-500">{sub.label}</p>
                    <IconPicker value={str(item[subKey])} onChange={write} />
                </div>
            );
        }

        if (sub.type === 'textarea') {
            return (
                <Textarea
                    key={subKey}
                    label={sub.label}
                    rows={sub.rows ?? 2}
                    value={str(item[subKey])}
                    onChange={(e) => write(e.target.value)}
                    error={errorFor(`${path}.${subKey}`)}
                />
            );
        }

        return (
            <Input
                key={subKey}
                containerClassName="!mb-0"
                label={sub.label}
                value={str(item[subKey])}
                onChange={(e) => write(e.target.value)}
                error={errorFor(`${path}.${subKey}`)}
            />
        );
    };

    /* ----------------------------------------------------- vista previa */

    const previewOf = (row: BlockRow) => {
        const d = row.data ?? {};
        const flow = rows.find((r) => r.type === 'flow');
        switch (row.type) {
            case 'hero':
                return <HeroBlock data={d} aside={flow ? <FlowBlock data={flow.data} offset={5} /> : undefined} />;
            case 'band':
                return <BandBlock data={d} />;
            case 'virtues':
                return <VirtuesBlock data={d} />;
            case 'audience':
                return <AudienceBlock data={d} />;
            case 'steps_media':
                return <StepsMediaBlock data={d} />;
            case 'quote':
                return <QuoteBlock data={d} />;
            case 'closing':
                return <ClosingBlock data={d} />;
            case 'data':
                return <DataBlock data={d} rows={row.rows ?? []} error={row.error} />;
            default:
                return null;
        }
    };

    /* ------------------------------------------------------------ UI */

    const blocksPanel = (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <span className="text-[11px] uppercase tracking-[.1em] text-slate-500">Bloques</span>
                <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-indigo-600 dark:text-indigo-400"
                >
                    <Plus size={14} /> Añadir
                </button>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
                {rows.map((row, i) => {
                    const entry = catalog[row.type];
                    const isActive = row.id === activeId;

                    return (
                        <div
                            key={row.id}
                            draggable
                            onDragStart={() => (dragFrom.current = i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                                const from = dragFrom.current;
                                dragFrom.current = null;
                                if (from == null || from === i) return;
                                const next = [...rows];
                                const [moved] = next.splice(from, 1);
                                next.splice(i, 0, moved);
                                persistOrder(next);
                            }}
                            className={`flex min-h-16 items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1 ${
                                isActive
                                    ? 'ring-indigo-500'
                                    : 'ring-slate-200 dark:ring-slate-700'
                            } ${row.is_visible ? '' : 'opacity-60'}`}
                        >
                            <span className="cursor-grab text-slate-400" aria-hidden="true">
                                <DotsSixVertical size={16} />
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveId(row.id);
                                    setTab('fields');
                                }}
                                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left"
                            >
                                <span
                                    className={`block truncate text-sm font-medium ${
                                        isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                >
                                    {entry?.label ?? row.type}
                                </span>
                                <span className="block truncate text-[11px] text-slate-500">
                                    {row.is_visible ? summarize(row.type, row.data) : 'Oculto en el sitio'}
                                </span>
                            </button>
                            <span className="flex shrink-0 flex-col lg:hidden">
                                <button type="button" onClick={() => moveBy(row.id, -1)} className="flex h-11 w-11 items-center justify-center text-slate-400" aria-label="Subir">
                                    <ArrowUp size={15} />
                                </button>
                                <button type="button" onClick={() => moveBy(row.id, 1)} className="flex h-11 w-11 items-center justify-center text-slate-400" aria-label="Bajar">
                                    <ArrowDown size={15} />
                                </button>
                            </span>
                            <button
                                type="button"
                                onClick={() => toggleVisible(row)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                                aria-label={row.is_visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
                            >
                                {row.is_visible ? <Eye size={17} /> : <EyeSlash size={17} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const previewPanel = (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <span className="text-[11px] uppercase tracking-[.1em] text-slate-500">Vista previa</span>
                <div className="hidden overflow-hidden rounded-lg border border-slate-300 lg:flex dark:border-slate-600">
                    {([['desktop', Desktop], ['mobile', DeviceMobile]] as const).map(([k, Icon]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setDevice(k)}
                            className={`flex h-9 items-center gap-1.5 px-3 text-xs ${
                                device === k ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            <Icon size={14} /> {k === 'desktop' ? 'Escritorio' : 'Móvil'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <div
                    className="public-scope mx-auto overflow-hidden rounded-xl"
                    style={{ maxWidth: device === 'mobile' ? 390 : '100%' }}
                >
                    {rows.map((row) => {
                        if (row.type === 'header' || row.type === 'footer' || row.type === 'flow') return null;
                        const node = previewOf(row);
                        if (!node) return null;
                        const isActive = row.id === activeId;

                        return (
                            // Contenedor seleccionable, no <button>: los bloques traen
                            // dentro sus propios botones y enlaces, y un boton anidado en
                            // otro es HTML invalido (React lo reporta como error).
                            <div
                                key={row.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setActiveId(row.id);
                                    setTab('fields');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setActiveId(row.id);
                                        setTab('fields');
                                    }
                                }}
                                className={`relative block w-full cursor-pointer text-left ring-1 ring-inset ${
                                    isActive ? 'ring-indigo-500' : 'ring-transparent hover:ring-slate-500'
                                } ${row.is_visible ? '' : 'opacity-40'}`}
                            >
                                <span
                                    className={`absolute left-3.5 top-1 z-10 rounded-[3px] px-[7px] py-px text-[10px] uppercase tracking-[.1em] ${
                                        isActive ? 'bg-indigo-500 text-slate-900' : 'bg-slate-900 text-slate-300'
                                    }`}
                                >
                                    {catalog[row.type]?.label ?? row.type}
                                    {row.is_visible ? '' : ' · Oculto'}
                                </span>
                                <BlockShell
                                    defaults={appearanceDefaults(row.type)}
                                    appearance={(row.data ?? {}).appearance}
                                    replayKey={animSignature(row)}
                                >
                                    {node}
                                </BlockShell>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                    Al hacer clic en cualquier bloque se activa; el panel derecho guarda sus campos.
                </p>
            </div>
        </div>
    );

    /**
     * Pestaña «Diseño»: los grupos de config/landing_appearance.php, con los mismos
     * controles genéricos que el contenido. Se guarda en `data.appearance`.
     */
    const designFields = (row: BlockRow) => {
        const values = appearanceOf(row);

        return (
            <>
                {Object.entries(appearanceSchema).map(([groupKey, group]) => (
                    <div key={groupKey} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[.1em] text-slate-500">
                            <span className="text-indigo-600 dark:text-indigo-400">{phosphorIcon(group.icon, 14)}</span>
                            {group.label}
                        </p>
                        {group.help ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{group.help}</p> : null}
                        <div className="mt-3 space-y-3">
                            {Object.entries(group.fields)
                                .filter(([, field]) => cumpleCondicion(field, values))
                                .map(([key, field]) => (
                                    <div key={key}>{renderField(key, field, values, 'data.appearance')}</div>
                                ))}
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={() =>
                        patchActive((d) => {
                            delete d.appearance;

                            return d;
                        })
                    }
                    className="flex h-11 items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                    <ArrowCounterClockwise size={14} /> Volver al diseño por defecto
                </button>
            </>
        );
    };

    const fieldsPanel = (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <span className="text-[11px] uppercase tracking-[.1em] text-slate-500">
                    Bloque · {schema?.label ?? '—'}
                    {saving ? <span className="ml-2 normal-case text-slate-400">Guardando…</span> : null}
                    {!saving && savedAt ? <span className="ml-2 normal-case text-emerald-600">Guardado</span> : null}
                </span>
                {active ? (
                    <span className="flex items-center">
                        <button
                            type="button"
                            onClick={() =>
                                router.post(route('super-admin.landing.blocks.duplicate', active.id), {}, { preserveScroll: true })
                            }
                            className="flex h-11 w-11 items-center justify-center text-slate-500"
                            aria-label="Duplicar bloque"
                        >
                            <Copy size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(active)}
                            className="flex h-11 w-11 items-center justify-center text-rose-500"
                            aria-label="Eliminar bloque"
                        >
                            <Trash size={16} />
                        </button>
                    </span>
                ) : null}
            </div>

            {/* Lo que dice el bloque y cómo se ve son dos formularios distintos. */}
            {active && catalog[active.type]?.appearance !== false ? (
                <div className="flex shrink-0 gap-1.5 px-4 pb-2.5">
                    {(['content', 'design'] as const).map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPanel(p)}
                            className={`h-9 flex-1 rounded-lg text-xs ${
                                panel === p
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 ring-1 ring-slate-200 dark:text-slate-300 dark:ring-slate-700'
                            }`}
                        >
                            {p === 'content' ? 'Contenido' : 'Diseño'}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="scrollbar-thin min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-4">
                {active && schema ? (
                    <>
                        {panel === 'design' && catalog[active.type]?.appearance !== false
                            ? designFields(active)
                            : Object.entries(schema.fields)
                                  // show_if: un campo que depende de otro solo se pinta cuando
                                  // aplica (la caja SQL solo con «consulta personalizada», etc.).
                                  .filter(([, field]) => cumpleCondicion(field, active.data ?? {}))
                                  .map(([key, field]) => (
                                      <div key={key}>{renderField(key, field, active.data ?? {}, 'data')}</div>
                                  ))}

                        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                            <span className="text-sm text-slate-700 dark:text-slate-300">Visible en el sitio</span>
                            <button
                                type="button"
                                onClick={() => toggleVisible(active)}
                                className={`relative h-6 w-[42px] rounded-full transition-colors ${
                                    active.is_visible ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                aria-label="Alternar visibilidad"
                            >
                                <span
                                    className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all"
                                    style={{ left: active.is_visible ? 21 : 3 }}
                                />
                            </button>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-500">Elige un bloque de la lista.</p>
                )}
            </div>
        </div>
    );

    return (
        <AppLayout title="Landing pública">
            <Head title="Landing pública" />

            <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden sm:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)]">
                {/* Barra superior */}
                <div className="flex h-14 shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded border border-indigo-500 text-indigo-600 dark:text-indigo-400">
                        <Needle size={14} />
                    </span>
                    <span className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                        Super usuario · Landing pública
                    </span>
                    <Badge variant={localDirty > 0 ? 'warning' : 'success'}>
                        {localDirty > 0 ? `Borrador con ${localDirty} ${localDirty === 1 ? 'cambio' : 'cambios'}` : 'Todo publicado'}
                    </Badge>

                    <div className="ml-auto flex items-center gap-2">
                        <Button variant="outline" className="min-h-9" icon={<ClockCounterClockwise size={15} />} onClick={openVersions}>
                            Versiones
                        </Button>
                        <a href="/?preview=1" target="_blank" rel="noreferrer">
                            <Button variant="outline" className="min-h-9" icon={<Eye size={15} />}>
                                Previsualizar
                            </Button>
                        </a>
                        <Button className="min-h-9" disabled={localDirty === 0} onClick={() => setConfirmPublish(true)}>
                            Publicar
                        </Button>
                    </div>
                </div>

                {/* Escritorio: tres columnas con scroll propio */}
                <div className="hidden min-h-0 flex-1 lg:grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr) 320px' }}>
                    <div className="min-h-0 border-r border-slate-200 dark:border-slate-700">{blocksPanel}</div>
                    <div className="min-h-0">{previewPanel}</div>
                    <div className="min-h-0 border-l border-slate-200 dark:border-slate-700">{fieldsPanel}</div>
                </div>

                {/* Movil: pestanas */}
                <div className="flex min-h-0 flex-1 flex-col lg:hidden">
                    <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-700">
                        {(['blocks', 'preview', 'fields'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`h-12 flex-1 text-sm ${
                                    tab === t
                                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-500'
                                }`}
                            >
                                {t === 'blocks' ? 'Bloques' : t === 'preview' ? 'Vista previa' : 'Campos'}
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1">
                        {tab === 'blocks' ? blocksPanel : null}
                        {tab === 'preview' ? previewPanel : null}
                        {tab === 'fields' ? fieldsPanel : null}
                    </div>
                </div>
            </div>

            {/* Versiones */}
            <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Versiones publicadas" size="lg">
                {versions.length === 0 ? (
                    <p className="text-sm text-slate-500">Aún no hay versiones publicadas.</p>
                ) : (
                    <div className="space-y-2">
                        {versions.map((v) => (
                            <div
                                key={v.id}
                                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                            >
                                <div>
                                    <p className="text-sm text-slate-900 dark:text-slate-100">
                                        {v.published_at ? new Date(v.published_at).toLocaleString() : '—'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {v.published_by ?? 'Sistema'} · {v.blocks} bloques
                                    </p>
                                </div>
                                <Button variant="outline" className="min-h-11" onClick={() => setConfirmRestore(v)}>
                                    Restaurar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            {/* Añadir bloque */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Añadir bloque" size="lg">
                <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(catalog).map(([type, entry]) => {
                        const used = rows.some((r) => r.type === type);
                        const disabled = entry.singleton && used;

                        return (
                            <button
                                key={type}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    router.post(
                                        route('super-admin.landing.blocks.store'),
                                        { type } as never,
                                        { preserveScroll: true, onSuccess: () => setAddOpen(false) },
                                    );
                                }}
                                className="flex min-h-14 items-center gap-2.5 rounded-lg border border-slate-200 px-3 text-left disabled:opacity-40 dark:border-slate-700"
                            >
                                <span className="text-indigo-600 dark:text-indigo-400">{phosphorIcon(entry.icon, 18)}</span>
                                <span className="text-sm text-slate-900 dark:text-slate-100">{entry.label}</span>
                                {disabled ? <span className="ml-auto text-[11px] text-slate-400">Ya existe</span> : null}
                            </button>
                        );
                    })}
                </div>
            </Modal>

            <ConfirmDialog
                open={confirmPublish}
                onClose={() => setConfirmPublish(false)}
                onConfirm={() => {
                    router.post(route('super-admin.landing.publish-blocks'), {}, {
                        preserveScroll: true,
                        onSuccess: () => toast.success('Landing publicada.'),
                        onFinish: () => setConfirmPublish(false),
                    });
                }}
                title="Publicar landing"
                message="Los visitantes verán el contenido actual del borrador. Se guardará una versión restaurable."
                confirmText="Publicar"
            />

            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => {
                    if (!confirmDelete) return;
                    router.delete(route('super-admin.landing.blocks.destroy', confirmDelete.id), {
                        preserveScroll: true,
                        onFinish: () => setConfirmDelete(null),
                    });
                }}
                title="Eliminar bloque"
                message="El bloque se quita de la landing. Puedes volver a añadirlo desde el catálogo."
                confirmText="Eliminar"
                variant="danger"
            />

            <ConfirmDialog
                open={!!confirmRestore}
                onClose={() => setConfirmRestore(null)}
                onConfirm={() => {
                    if (!confirmRestore) return;
                    router.post(route('super-admin.landing.versions.restore', confirmRestore.id), {}, {
                        preserveScroll: true,
                        onFinish: () => {
                            setConfirmRestore(null);
                            setVersionsOpen(false);
                        },
                    });
                }}
                title="Restaurar versión"
                message="Se repone el borrador con esa versión. No sale al aire hasta que publiques."
                confirmText="Restaurar"
            />
        </AppLayout>
    );
}

/**
 * Motivo real del fallo al subir una imagen. El servidor ya manda un mensaje concreto
 * (peso, formato); mostrarlo evita que el super usuario adivine por que fue rechazada.
 */
async function uploadError(res: Response): Promise<string> {
    if (res.status === 419) {
        return 'La sesión expiró. Recarga la página e inténtalo de nuevo.';
    }

    // 413 lo devuelve el servidor web antes de que Laravel vea la petición.
    if (res.status === 413) {
        return 'El archivo supera el tamaño que acepta el servidor (upload_max_filesize en php.ini).';
    }

    try {
        const d = await res.json();

        return d?.errors?.image?.[0] ?? d?.message ?? `No se pudo subir la imagen (error ${res.status}).`;
    } catch {
        return `No se pudo subir la imagen (error ${res.status}).`;
    }
}

/** Escribe un valor en una ruta anidada del payload sin mutar el original. */
function setDeep(obj: Dict, path: string[], value: unknown): Dict {
    if (path.length === 0) return obj;
    const [head, ...rest] = path;
    if (rest.length === 0) {
        obj[head] = value;
        return obj;
    }
    const child = (obj[head] ?? {}) as Dict;
    obj[head] = setDeep(child, rest, value);
    return obj;
}
