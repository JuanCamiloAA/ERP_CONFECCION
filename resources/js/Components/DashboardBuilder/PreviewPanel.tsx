import axios from 'axios';
import { Play, Warning } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { DynamicChart } from '@/Components/Dashboard/DynamicChart';
import type { WidgetFormData } from '@/Components/DashboardBuilder/WidgetFormFields';
import type { WidgetDataPayload } from '@/Components/DashboardBuilder/dashboard-builder-types';
import { formatNumber } from '@/lib/utils';

export interface PreviewMeta {
    rows: number;
    duration_ms: number;
    company_label: string;
    generated_sql: string | null;
}

export interface PreviewState {
    data: WidgetDataPayload | null;
    meta: PreviewMeta | null;
    error: string | null;
    loading: boolean;
    ranAt: number | null;
    run: () => Promise<void>;
}

/**
 * Ejecuta la vista previa contra el backend.
 *
 * El estado vive en el cascarón del editor (no en el panel) para que sobreviva al cambio
 * de pestaña: probar la consulta en «Definición» y perder el resultado al pasar a
 * «Apariencia» obligaría a ejecutarla otra vez para nada.
 */
export function useWidgetPreview(form: WidgetFormData, initialSql: string | null = null): PreviewState {
    const [data, setData] = useState<WidgetDataPayload | null>(null);
    const [meta, setMeta] = useState<PreviewMeta | null>(
        initialSql ? { rows: 0, duration_ms: 0, company_label: '', generated_sql: initialSql } : null,
    );
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [ranAt, setRanAt] = useState<number | null>(null);

    const run = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: result } = await axios.post<WidgetDataPayload & { meta?: PreviewMeta }>(
                route('super-admin.dashboard-widgets.preview'),
                {
                    type: form.type,
                    query_mode: form.query_mode,
                    query_definition: form.query_definition,
                    raw_sql: form.raw_sql,
                },
                { headers: { Accept: 'application/json' } },
            );

            const { meta: resultMeta, ...payload } = result;
            setData(payload as WidgetDataPayload);
            setMeta(resultMeta ?? null);
            setRanAt(Date.now());
        } catch (requestError) {
            const message = axios.isAxiosError(requestError)
                ? ((requestError.response?.data as { message?: string } | undefined)?.message ??
                  'No se pudo previsualizar la consulta.')
                : 'No se pudo previsualizar la consulta.';

            // La ultima vista previa buena NO se borra: perderla al fallar deja la pantalla
            // en blanco justo cuando hay que comparar lo que salia antes con el error.
            setError(message);

            if (axios.isAxiosError(requestError)) {
                const failedSql = (requestError.response?.data as { meta?: { generated_sql?: string | null } } | undefined)
                    ?.meta?.generated_sql;
                if (failedSql) {
                    setMeta((current) => ({
                        rows: current?.rows ?? 0,
                        duration_ms: current?.duration_ms ?? 0,
                        company_label: current?.company_label ?? '',
                        generated_sql: failedSql,
                    }));
                }
            }
        } finally {
            setLoading(false);
        }
    }, [form.type, form.query_mode, form.query_definition, form.raw_sql]);

    return { data, meta, error, loading, ranAt, run };
}

function secondsAgo(timestamp: number | null): string {
    if (! timestamp) return '';

    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 60) return `hace ${seconds} s`;

    return `hace ${Math.round(seconds / 60)} min`;
}

interface Props {
    form: WidgetFormData;
    preview: PreviewState;
    /** En móvil el panel va arriba y más compacto. */
    compact?: boolean;
}

/**
 * Vista previa al tamaño real de la tarjeta.
 *
 * Antes vivía al final de una tarjeta larga y medía 64 px: había que bajar a buscarla y
 * lo que se veía no se parecía a lo que iba a salir en el dashboard.
 */
export function PreviewPanel({ form, preview, compact = false }: Props) {
    return (
        <section className="emp-card p-[15px_16px]">
            <header className="flex items-center justify-between gap-2">
                <p className="emp-kicker">Vista previa en vivo</p>
                <button
                    type="button"
                    onClick={() => void preview.run()}
                    disabled={preview.loading}
                    className="emp-btn emp-btn-sm emp-btn-primary"
                >
                    <Play size={13} />
                    {preview.loading ? 'Probando…' : 'Probar consulta'}
                </button>
            </header>

            <div
                className="mt-2.5 w-full min-w-0 rounded-[12px] p-3"
                style={{
                    backgroundColor: 'var(--emp-field-alt)',
                    border: '1px solid var(--emp-border)',
                    minHeight: compact ? '160px' : '210px',
                }}
            >
                {preview.data ? (
                    <DynamicChart
                        type={form.type}
                        data={preview.data}
                        config={form.chart_config}
                        title={form.title || 'Vista previa'}
                    />
                ) : (
                    <p
                        className="flex h-full min-h-[140px] items-center justify-center px-3 text-center text-[12.5px]"
                        style={{ color: 'var(--emp-subtle)' }}
                    >
                        Pulsa «Probar consulta» para ver la tarjeta con datos reales de la empresa seleccionada.
                    </p>
                )}
            </div>

            {preview.error ? (
                <div className="emp-note mt-2.5" style={{ borderLeftColor: 'var(--emp-danger)' }}>
                    <p className="flex items-start gap-1.5" style={{ color: 'var(--emp-danger)' }}>
                        <Warning size={14} className="mt-0.5 shrink-0" />
                        {preview.error}
                    </p>
                </div>
            ) : null}

            {preview.meta && preview.ranAt ? (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    Ejecutado {secondsAgo(preview.ranAt)} con{' '}
                    <span style={{ color: 'var(--emp-text)' }}>{preview.meta.company_label}</span> ·{' '}
                    {formatNumber(preview.meta.rows)} {preview.meta.rows === 1 ? 'fila leída' : 'filas leídas'} ·{' '}
                    {formatNumber(preview.meta.duration_ms)} ms
                </p>
            ) : (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--emp-subtle)' }}>
                    Se ejecuta con la empresa del selector superior (o consolidado si no hay ninguna elegida).
                </p>
            )}
        </section>
    );
}

export default PreviewPanel;
