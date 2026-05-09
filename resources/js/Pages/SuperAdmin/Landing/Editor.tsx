import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowTopRightOnSquareIcon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { FormEvent, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/Components/UI/Badge';
import { Button } from '@/Components/UI/Button';
import { Card, CardHeader } from '@/Components/UI/Card';
import { Input } from '@/Components/UI/Input';
import { PageHeader } from '@/Components/UI/PageHeader';
import { Select } from '@/Components/UI/Select';
import { Textarea } from '@/Components/UI/Textarea';
import AppLayout from '@/Layouts/AppLayout';
import { cn } from '@/lib/utils';

interface SectionRow {
    slug: string;
    title_internal: string;
    sort_order: number;
    status: string;
    is_system: boolean;
    published_at: string | null;
    draft_payload: Record<string, unknown> | null;
    live_payload: Record<string, unknown> | null;
}

interface GlobalsForm {
    site_name: string | null;
    meta_title: string | null;
    meta_description: string | null;
    og_image_path: string | null;
    header_logo_path: string | null;
    favicon_path: string | null;
    footer_privacy_url: string | null;
    footer_terms_url: string | null;
    footer_contact_url: string | null;
    navbar_cta_text: string | null;
    navbar_cta_url: string | null;
    footer_legal_text: string | null;
    plan_inquiry_notify_email: string | null;
}

interface CompanyPartnerOption {
    id: number;
    name: string;
    logo_url: string | null;
}

interface PartnerDraftItem {
    company_id?: number;
    name?: string;
    logo_path?: string;
    url?: string;
    sort?: number;
}

interface Props {
    sections: SectionRow[];
    globals: GlobalsForm;
    companiesForPartners?: CompanyPartnerOption[];
}

async function uploadLandingFile(file: File): Promise<{ path: string; url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const res = await fetch(route('super-admin.landing.media'), {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': token,
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: fd,
        credentials: 'same-origin',
    });

    const ct = res.headers.get('content-type') ?? '';
    const raw = await res.text();

    if (!res.ok || !ct.includes('application/json')) {
        if (ct.includes('application/json')) {
            try {
                const err = JSON.parse(raw) as { message?: string; errors?: Record<string, string[]> };
                const msg =
                    err.message ??
                    (err.errors ? Object.values(err.errors).flat().join(' ') : null) ??
                    'Error al subir archivo';
                throw new Error(msg);
            } catch {
                throw new Error(raw.slice(0, 200) || 'Error al subir archivo');
            }
        }
        if (res.status === 419) {
            throw new Error('Sesion o token CSRF expirado. Recarga la pagina del editor e intenta de nuevo.');
        }
        throw new Error(
            raw.replace(/<[^>]+>/g, ' ').slice(0, 180).trim() || `Error ${res.status} al subir archivo`,
        );
    }

    return JSON.parse(raw) as { path: string; url: string };
}

function deepClone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

function SectionBannerEditorFields({
    draft,
    setDraft,
    busy,
    setPathField,
    defaultOpacity = 0,
    showImageUpload = true,
    title = 'Banner (fondo de la sección)',
    hint,
}: {
    draft: Record<string, unknown>;
    setDraft: Dispatch<SetStateAction<Record<string, unknown>>>;
    busy: boolean;
    setPathField: (field: string, file: File | null) => void;
    defaultOpacity?: number;
    showImageUpload?: boolean;
    title?: string;
    hint?: string;
}) {
    const op = Number(draft.banner_overlay_opacity ?? defaultOpacity);
    return (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
            {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
            {!hint ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Opacidad del velo oscuro (0 = ninguno). Puedes subir una imagen opcional de fondo.
                </p>
            ) : null}
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Opacidad de la capa: {op}%
                </label>
                <input
                    type="range"
                    min={0}
                    max={100}
                    className="w-full accent-indigo-600"
                    disabled={busy}
                    value={op}
                    onChange={(e) =>
                        setDraft((prev) => ({
                            ...prev,
                            banner_overlay_opacity: Number(e.target.value),
                        }))
                    }
                />
            </div>
            {showImageUpload ? (
                <div>
                    <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Imagen de fondo (opcional)</p>
                    <p className="mb-2 text-xs text-slate-500">
                        {String(draft.banner_image_path ?? '') || '— sin archivo —'}
                    </p>
                    <input
                        type="file"
                        accept="image/*"
                        className="text-sm"
                        disabled={busy}
                        onChange={(e) => setPathField('banner_image_path', e.target.files?.[0] ?? null)}
                    />
                </div>
            ) : null}
        </div>
    );
}

export default function LandingEditor({
    sections: initialSections,
    globals: initialGlobals,
    companiesForPartners: initialCompaniesForPartners = [],
}: Props) {
    const page = usePage<{ sections: SectionRow[]; companiesForPartners?: CompanyPartnerOption[] }>();
    const sections = (page.props.sections ?? initialSections) as SectionRow[];
    const companiesForPartners = (page.props.companiesForPartners ?? initialCompaniesForPartners) as CompanyPartnerOption[];

    const [selectedSlug, setSelectedSlug] = useState(sections[0]?.slug ?? '');
    const [draft, setDraft] = useState<Record<string, unknown>>({});

    const selected = useMemo(() => sections.find((s) => s.slug === selectedSlug), [sections, selectedSlug]);

    useEffect(() => {
        const s = sections.find((x) => x.slug === selectedSlug);
        setDraft(deepClone((s?.draft_payload ?? {}) as Record<string, unknown>));
    }, [selectedSlug, sections]);

    useEffect(() => {
        if (sections.length === 0) {
            setSelectedSlug('');
            return;
        }
        if (selectedSlug && !sections.some((s) => s.slug === selectedSlug)) {
            setSelectedSlug(sections[0].slug);
        }
    }, [sections, selectedSlug]);

    const globalsForm = useForm({
        ...initialGlobals,
    });

    const [newCustomTitle, setNewCustomTitle] = useState('');
    const [busy, setBusy] = useState(false);

    const previewLive = () => {
        window.open(route('landing'), '_blank');
    };

    const saveDraft = () => {
        if (!selectedSlug) return;
        router.put(
            route('super-admin.landing.sections.update', selectedSlug),
            { draft_payload: draft },
            { preserveScroll: true, onFinish: () => toast.success('Borrador guardado') },
        );
    };

    const publishSection = () => {
        if (!selectedSlug) return;
        router.post(route('super-admin.landing.sections.publish', selectedSlug), {}, { preserveScroll: true });
    };

    const discardDraft = () => {
        if (!selectedSlug) return;
        router.post(route('super-admin.landing.sections.discard', selectedSlug), {}, { preserveScroll: true });
    };

    const resetDraft = () => {
        if (!selectedSlug) return;
        router.post(route('super-admin.landing.sections.reset', selectedSlug), {}, { preserveScroll: true });
    };

    const publishAll = () => {
        router.post(route('super-admin.landing.publish-all'), {}, { preserveScroll: true });
    };

    const deleteSection = () => {
        if (!selected || selected.is_system) return;
        if (!window.confirm(`Eliminar la seccion "${selected.title_internal}"? Esta accion no se puede deshacer.`)) return;
        router.delete(route('super-admin.landing.sections.destroy', selected.slug), {
            preserveScroll: true,
            onSuccess: () => toast.success('Seccion eliminada'),
        });
    };

    const deleteSectionBySlug = (slug: string, titleInternal: string) => {
        if (!window.confirm(`Eliminar "${titleInternal}"? Esta accion no se puede deshacer.`)) return;
        router.delete(route('super-admin.landing.sections.destroy', slug), {
            preserveScroll: true,
            onSuccess: () => toast.success('Seccion eliminada'),
        });
    };

    const addCustom = (e: FormEvent) => {
        e.preventDefault();
        if (!newCustomTitle.trim()) return;
        router.post(route('super-admin.landing.sections.store'), { title_internal: newCustomTitle.trim() }, { preserveScroll: true });
        setNewCustomTitle('');
    };

    const saveGlobals = (e: FormEvent) => {
        e.preventDefault();
        globalsForm.put(route('super-admin.landing.globals'), { preserveScroll: true });
    };

    const setPathField = useCallback(async (field: string, file: File | null) => {
        if (!file) return;
        try {
            setBusy(true);
            const { path } = await uploadLandingFile(file);
            setDraft((prev) => ({ ...prev, [field]: path }));
            toast.success('Archivo subido. Guarda el borrador.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error de subida');
        } finally {
            setBusy(false);
        }
    }, []);

    const setGlobalsPath = useCallback(
        async (field: keyof GlobalsForm, file: File | null) => {
            if (!file) return;
            try {
                setBusy(true);
                const { path } = await uploadLandingFile(file);
                globalsForm.setData(field, path);
                toast.success('Archivo subido. Guarda ajustes globales.');
            } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error de subida');
            } finally {
                setBusy(false);
            }
        },
        [globalsForm],
    );

    const updateFeature = (idx: number, key: string, value: string) => {
        const items = [...((draft.items as { icon?: string; title?: string; description?: string }[]) ?? [])];
        items[idx] = { ...items[idx], [key]: value };
        setDraft((p) => ({ ...p, items }));
    };

    const addFeature = () => {
        setDraft((p) => {
            const cur = [...((p.items as object[]) ?? [])];
            cur.push({ icon: 'SparklesIcon', title: '', description: '' });
            return { ...p, items: cur };
        });
    };

    const removeFeature = (idx: number) => {
        const items = [...((draft.items as object[]) ?? [])];
        items.splice(idx, 1);
        setDraft((p) => ({ ...p, items }));
    };

    const updatePartner = (idx: number, key: string, value: string | number) => {
        const items = [...((draft.items as PartnerDraftItem[]) ?? [])];
        items[idx] = { ...items[idx], [key]: value };
        setDraft((p) => ({ ...p, items }));
    };

    const setPartnerCompany = (idx: number, companyIdStr: string) => {
        setDraft((p) => {
            const items = [...((p.items as PartnerDraftItem[]) ?? [])];
            const row = { ...items[idx] };
            if (companyIdStr === '') {
                delete row.company_id;
            } else {
                const id = Number(companyIdStr);
                row.company_id = id;
                const co = companiesForPartners.find((c) => c.id === id);
                if (co) {
                    row.name = co.name;
                    row.logo_path = '';
                    row.url = `/login?company=${id}`;
                }
            }
            items[idx] = row;
            return { ...p, items };
        });
    };

    const addPartner = () => {
        setDraft((p) => {
            const cur = [...((p.items as object[]) ?? [])];
            cur.push({ name: '', logo_path: '', url: '#', sort: cur.length });
            return { ...p, items: cur };
        });
    };

    const removePartner = (idx: number) => {
        const items = [...((draft.items as object[]) ?? [])];
        items.splice(idx, 1);
        setDraft((p) => ({ ...p, items }));
    };

    const isCustom = selectedSlug.startsWith('custom-');

    return (
        <AppLayout title="Editor landing">
            <Head title="Editor landing" />
            <div className="space-y-6">
                <PageHeader
                    title="Landing Page Editor"
                    description="Borradores y publicacion en vivo del sitio publico."
                    breadcrumbs={[{ label: 'Super admin', href: route('super-admin.data-imports.index') }, { label: 'Landing' }]}
                    action={
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="ghost" icon={<ArrowTopRightOnSquareIcon className="h-4 w-4" />} onClick={previewLive}>
                                Preview en vivo
                            </Button>
                            <Button type="button" variant="secondary" loading={busy} onClick={publishAll}>
                                Publicar todo
                            </Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-4 lg:col-span-4">
                        <Card>
                            <CardHeader title="Secciones" />
                            <ul className="mt-3 space-y-2">
                                {sections.map((s) => (
                                    <li key={s.slug} className="flex items-stretch gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSlug(s.slug)}
                                            className={cn(
                                                'flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2 text-left text-sm transition',
                                                selectedSlug === s.slug
                                                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                                                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500',
                                            )}
                                        >
                                            <span className="font-medium text-slate-900 dark:text-slate-100">{s.title_internal}</span>
                                            <span className="mt-1 flex flex-wrap gap-2">
                                                <Badge variant={s.status === 'live' ? 'success' : 'warning'}>{s.status.toUpperCase()}</Badge>
                                                {s.is_system ? (
                                                    <Badge variant="neutral">Sistema</Badge>
                                                ) : (
                                                    <Badge variant="neutral">Custom</Badge>
                                                )}
                                            </span>
                                        </button>
                                        {!s.is_system ? (
                                            <button
                                                type="button"
                                                title="Eliminar seccion"
                                                className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2 text-rose-600 transition hover:bg-rose-50 dark:border-slate-600 dark:hover:bg-rose-950/50"
                                                onClick={() => deleteSectionBySlug(s.slug, s.title_internal)}
                                            >
                                                <span className="sr-only">Eliminar seccion</span>
                                                <TrashIcon className="h-4 w-4" aria-hidden />
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card className="border-dashed border-2 border-slate-300 dark:border-slate-600">
                            <CardHeader title="Nueva seccion personalizada" />
                            <form onSubmit={addCustom} className="mt-3 space-y-2">
                                <Input label="Titulo interno" value={newCustomTitle} onChange={(e) => setNewCustomTitle(e.target.value)} />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Podras definir titulo publico, subtitulo, texto, banner (imagen + velo), imagen lateral y botones como en el hero.
                                </p>
                                <Button type="submit" variant="secondary" icon={<PlusIcon className="h-4 w-4" />}>
                                    Anadir
                                </Button>
                            </form>
                        </Card>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <p>
                                Usa <strong>Publicar</strong> para copiar el borrador al sitio. <strong>Descartar</strong> vuelve al contenido en vivo.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6 lg:col-span-8">
                        {selected ? (
                            <Card>
                                <CardHeader title={selected.title_internal} />
                                <div className="mt-4 space-y-4">
                                    {selectedSlug === 'hero' ? (
                                        <>
                                            <Input
                                                label="Titular"
                                                value={String(draft.headline ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, headline: e.target.value }))}
                                            />
                                            <Textarea
                                                label="Subtitulo"
                                                value={String(draft.subtext ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, subtext: e.target.value }))}
                                                rows={3}
                                            />
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <Input
                                                    label="CTA primario (texto)"
                                                    value={String(draft.primary_cta_text ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, primary_cta_text: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA primario (URL)"
                                                    value={String(draft.primary_cta_url ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, primary_cta_url: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA secundario (texto)"
                                                    value={String(draft.secondary_cta_text ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, secondary_cta_text: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA secundario (URL)"
                                                    value={String(draft.secondary_cta_url ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, secondary_cta_url: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Imagen de fondo</p>
                                                <p className="mb-2 text-xs text-slate-500">{String(draft.background_image_path ?? '')}</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="text-sm"
                                                    disabled={busy}
                                                    onChange={(e) => setPathField('background_image_path', e.target.files?.[0] ?? null)}
                                                />
                                            </div>
                                            <Input
                                                label="Alt imagen"
                                                value={String(draft.background_image_alt ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, background_image_alt: e.target.value }))}
                                            />
                                            <SectionBannerEditorFields
                                                title="Velo sobre la imagen del hero"
                                                hint="Solo aplica cuando hay imagen de fondo; sin imagen se mantiene el gradiente fijo. Valor por defecto al cargar: 72%."
                                                draft={draft}
                                                setDraft={setDraft}
                                                busy={busy}
                                                setPathField={setPathField}
                                                defaultOpacity={72}
                                                showImageUpload={false}
                                            />
                                        </>
                                    ) : null}

                                    {selectedSlug === 'features' ? (
                                        <div className="space-y-3">
                                            <SectionBannerEditorFields draft={draft} setDraft={setDraft} busy={busy} setPathField={setPathField} />
                                            {(draft.items as object[] | undefined)?.map((_, idx) => (
                                                <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
                                                    <div className="grid gap-2 sm:grid-cols-3">
                                                        <Input
                                                            label="Icono (Heroicon)"
                                                            value={(draft.items as { icon?: string }[])[idx]?.icon ?? ''}
                                                            onChange={(e) => updateFeature(idx, 'icon', e.target.value)}
                                                        />
                                                        <Input
                                                            label="Titulo"
                                                            value={(draft.items as { title?: string }[])[idx]?.title ?? ''}
                                                            onChange={(e) => updateFeature(idx, 'title', e.target.value)}
                                                        />
                                                        <div className="flex items-end">
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeFeature(idx)}>
                                                                Quitar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <Textarea
                                                        label="Descripcion"
                                                        className="mt-2"
                                                        value={(draft.items as { description?: string }[])[idx]?.description ?? ''}
                                                        onChange={(e) => updateFeature(idx, 'description', e.target.value)}
                                                        rows={2}
                                                    />
                                                </div>
                                            ))}
                                            <Button type="button" variant="secondary" onClick={addFeature}>
                                                Anadir tarjeta
                                            </Button>
                                        </div>
                                    ) : null}

                                    {selectedSlug === 'partners' ? (
                                        <div className="space-y-3">
                                            <SectionBannerEditorFields draft={draft} setDraft={setDraft} busy={busy} setPathField={setPathField} />
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Puedes vincular cada tarjeta a una <strong>empresa del maestro</strong> (nombre y logo se toman de su
                                                ficha; la URL sugiere el login con <code className="text-xs">?company=</code>). O deja &quot;Manual&quot;
                                                y define nombre y logo por archivo.
                                            </p>
                                            {(draft.items as object[] | undefined)?.map((_, idx) => {
                                                const row = (draft.items as PartnerDraftItem[])[idx];
                                                const cid = row?.company_id;
                                                const linked = cid != null && cid !== undefined;
                                                const co = linked ? companiesForPartners.find((c) => c.id === cid) : null;
                                                return (
                                                    <div key={idx} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
                                                        <Select
                                                            label="Empresa (maestro)"
                                                            placeholder="Manual: nombre y logo propios"
                                                            options={companiesForPartners.map((c) => ({
                                                                value: String(c.id),
                                                                label: c.name,
                                                            }))}
                                                            value={linked ? String(cid) : ''}
                                                            onChange={(e) => setPartnerCompany(idx, e.target.value)}
                                                            searchable
                                                        />
                                                        {linked ? (
                                                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50">
                                                                {co?.logo_url ? (
                                                                    <img src={co.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-600" />
                                                                ) : (
                                                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500 dark:bg-slate-700">Sin logo</div>
                                                                )}
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{row?.name ?? co?.name ?? 'Empresa'}</p>
                                                                    <p className="text-xs text-slate-500">Logo y nombre desde datos maestros</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Input
                                                                label="Nombre (manual)"
                                                                value={row?.name ?? ''}
                                                                onChange={(e) => updatePartner(idx, 'name', e.target.value)}
                                                            />
                                                        )}
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <Input
                                                                label="URL del enlace"
                                                                value={row?.url ?? ''}
                                                                onChange={(e) => updatePartner(idx, 'url', e.target.value)}
                                                            />
                                                            <Input
                                                                type="number"
                                                                label="Orden"
                                                                value={String(row?.sort ?? idx)}
                                                                onChange={(e) => updatePartner(idx, 'sort', Number(e.target.value))}
                                                            />
                                                        </div>
                                                        {!linked ? (
                                                            <>
                                                                <p className="text-xs text-slate-500">Logo (archivo): {row?.logo_path ?? '—'}</p>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="text-sm"
                                                                    disabled={busy}
                                                                    onChange={async (e) => {
                                                                        const file = e.target.files?.[0] ?? null;
                                                                        if (!file) return;
                                                                        try {
                                                                            setBusy(true);
                                                                            const { path } = await uploadLandingFile(file);
                                                                            setDraft((p) => {
                                                                                const items = [...((p.items as PartnerDraftItem[]) ?? [])];
                                                                                items[idx] = { ...items[idx], logo_path: path };
                                                                                return { ...p, items };
                                                                            });
                                                                            toast.success('Logo subido');
                                                                        } catch (err) {
                                                                            toast.error(err instanceof Error ? err.message : 'Error');
                                                                        } finally {
                                                                            setBusy(false);
                                                                        }
                                                                    }}
                                                                />
                                                            </>
                                                        ) : null}
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => removePartner(idx)}>
                                                            Quitar
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                            <Button type="button" variant="secondary" onClick={addPartner}>
                                                Anadir socio
                                            </Button>
                                        </div>
                                    ) : null}

                                    {selectedSlug === 'membership_plans' ? (
                                        <>
                                            <SectionBannerEditorFields draft={draft} setDraft={setDraft} busy={busy} setPathField={setPathField} />
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                La tabla de precios se genera en la landing con los planes <strong>activos</strong> definidos en{' '}
                                                <strong>Super admin → Planes de membresía</strong>. Aquí solo ajustas títulos y apariencia del bloque.
                                            </p>
                                            <Input
                                                label="Titulo de la seccion"
                                                value={String(draft.title ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                                            />
                                            <Textarea
                                                label="Subtitulo"
                                                value={String(draft.subtitle ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                                                rows={2}
                                            />
                                            <Textarea
                                                label="Nota al pie (opcional)"
                                                value={String(draft.footnote ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, footnote: e.target.value }))}
                                                rows={3}
                                            />
                                        </>
                                    ) : null}

                                    {selectedSlug === 'about' ? (
                                        <>
                                            <SectionBannerEditorFields draft={draft} setDraft={setDraft} busy={busy} setPathField={setPathField} />
                                            <Input
                                                label="Titulo"
                                                value={String(draft.title ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                                            />
                                            <Textarea
                                                label="Cuerpo"
                                                value={String(draft.body ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
                                                rows={8}
                                            />
                                            <p className="text-xs text-slate-500">Imagen: {String(draft.image_path ?? '')}</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="text-sm"
                                                disabled={busy}
                                                onChange={(e) => setPathField('image_path', e.target.files?.[0] ?? null)}
                                            />
                                        </>
                                    ) : null}

                                    {isCustom ? (
                                        <>
                                            <SectionBannerEditorFields draft={draft} setDraft={setDraft} busy={busy} setPathField={setPathField} />
                                            <Select
                                                label="Alineacion del bloque"
                                                searchable={false}
                                                options={[
                                                    { value: 'left', label: 'Izquierda' },
                                                    { value: 'center', label: 'Centrada' },
                                                ]}
                                                value={String(draft.text_align ?? 'left')}
                                                onChange={(e) => setDraft((p) => ({ ...p, text_align: e.target.value }))}
                                            />
                                            <Input
                                                label="Titulo (publico)"
                                                value={String(draft.title ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                                            />
                                            <Input
                                                label="Subtitulo (opcional)"
                                                value={String(draft.subtitle ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                                            />
                                            <Textarea
                                                label="Cuerpo (texto plano)"
                                                value={String(draft.body_markdown ?? '')}
                                                onChange={(e) => setDraft((p) => ({ ...p, body_markdown: e.target.value }))}
                                                rows={8}
                                            />
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Input
                                                    label="CTA primario (texto)"
                                                    value={String(draft.primary_cta_text ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, primary_cta_text: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA primario (URL)"
                                                    value={String(draft.primary_cta_url ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, primary_cta_url: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA secundario (texto)"
                                                    value={String(draft.secondary_cta_text ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, secondary_cta_text: e.target.value }))}
                                                />
                                                <Input
                                                    label="CTA secundario (URL)"
                                                    value={String(draft.secondary_cta_url ?? '')}
                                                    onChange={(e) => setDraft((p) => ({ ...p, secondary_cta_url: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Imagen de contenido (opcional, lateral en pantallas grandes)
                                                </p>
                                                <p className="mb-2 text-xs text-slate-500">{String(draft.content_image_path ?? '') || '— sin archivo —'}</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="text-sm"
                                                    disabled={busy}
                                                    onChange={(e) => setPathField('content_image_path', e.target.files?.[0] ?? null)}
                                                />
                                            </div>
                                        </>
                                    ) : null}

                                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                                        <Button type="button" onClick={saveDraft}>
                                            Guardar borrador
                                        </Button>
                                        <Button type="button" variant="secondary" onClick={publishSection}>
                                            Publicar seccion
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={discardDraft}>
                                            Descartar borrador
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={resetDraft}>
                                            Restablecer por defecto
                                        </Button>
                                        {!selected.is_system ? (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50"
                                                icon={<TrashIcon className="h-4 w-4" />}
                                                onClick={deleteSection}
                                            >
                                                Eliminar seccion
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <p className="text-sm text-slate-500">Selecciona una seccion.</p>
                        )}

                        <Card>
                            <CardHeader title="Ajustes globales / SEO" />
                            <form onSubmit={saveGlobals} className="mt-4 space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Input label="Nombre del sitio" value={globalsForm.data.site_name ?? ''} onChange={(e) => globalsForm.setData('site_name', e.target.value)} />
                                    <Input label="Titulo SEO" value={globalsForm.data.meta_title ?? ''} onChange={(e) => globalsForm.setData('meta_title', e.target.value)} />
                                </div>
                                <Textarea label="Meta descripcion" value={globalsForm.data.meta_description ?? ''} onChange={(e) => globalsForm.setData('meta_description', e.target.value)} rows={3} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Input label="CTA navbar (texto)" value={globalsForm.data.navbar_cta_text ?? ''} onChange={(e) => globalsForm.setData('navbar_cta_text', e.target.value)} />
                                    <Input label="CTA navbar (URL)" value={globalsForm.data.navbar_cta_url ?? ''} onChange={(e) => globalsForm.setData('navbar_cta_url', e.target.value)} />
                                    <Input
                                        label="Correo para solicitudes de plan (opcional)"
                                        type="email"
                                        description="Si lo completa, las notificaciones del formulario van solo a este correo. Si está vacío, se envían a todos los super administradores activos. También habilita el botón «Abrir en mi correo» en la landing."
                                        value={globalsForm.data.plan_inquiry_notify_email ?? ''}
                                        onChange={(e) => globalsForm.setData('plan_inquiry_notify_email', e.target.value || null)}
                                    />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div>
                                        <p className="mb-1 text-sm font-medium">Logo cabecera (path)</p>
                                        <p className="mb-1 truncate text-xs text-slate-500">{globalsForm.data.header_logo_path}</p>
                                        <input type="file" accept="image/*" disabled={busy} onChange={(e) => setGlobalsPath('header_logo_path', e.target.files?.[0] ?? null)} />
                                    </div>
                                    <div>
                                        <p className="mb-1 text-sm font-medium">OG imagen</p>
                                        <p className="mb-1 truncate text-xs text-slate-500">{globalsForm.data.og_image_path}</p>
                                        <input type="file" accept="image/*" disabled={busy} onChange={(e) => setGlobalsPath('og_image_path', e.target.files?.[0] ?? null)} />
                                    </div>
                                    <div>
                                        <p className="mb-1 text-sm font-medium">Favicon</p>
                                        <p className="mb-1 truncate text-xs text-slate-500">{globalsForm.data.favicon_path}</p>
                                        <input type="file" accept="image/*" disabled={busy} onChange={(e) => setGlobalsPath('favicon_path', e.target.files?.[0] ?? null)} />
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Input label="URL privacidad" value={globalsForm.data.footer_privacy_url ?? ''} onChange={(e) => globalsForm.setData('footer_privacy_url', e.target.value)} />
                                    <Input label="URL terminos" value={globalsForm.data.footer_terms_url ?? ''} onChange={(e) => globalsForm.setData('footer_terms_url', e.target.value)} />
                                    <Input label="URL contacto" value={globalsForm.data.footer_contact_url ?? ''} onChange={(e) => globalsForm.setData('footer_contact_url', e.target.value)} />
                                </div>
                                <Textarea label="Texto legal pie" value={globalsForm.data.footer_legal_text ?? ''} onChange={(e) => globalsForm.setData('footer_legal_text', e.target.value)} rows={2} />
                                <Button type="submit" loading={globalsForm.processing}>
                                    Guardar globales
                                </Button>
                            </form>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
