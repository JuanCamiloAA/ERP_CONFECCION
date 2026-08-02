import { Card, CardHeader } from '@/Components/UI/Card';
import { DynamicChart } from '@/Components/Dashboard/DynamicChart';
import { useWidgetData } from '@/Components/Dashboard/useWidgetData';
import type { WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';

export interface CustomWidgetMeta {
    id: number;
    title: string;
    type: WidgetType;
    refresh_interval_seconds: number;
    position: number;
}

/**
 * Panel de un widget personalizado (creado en el constructor de dashboards) listo para
 * insertarse en el DashboardGrid junto a los paneles de sistema. Los KPI se ven como
 * StatCard "pelado" (mismo estilo que las tarjetas por defecto); el resto (bar/line/pie/table)
 * se ve dentro de un Card con encabezado, igual que antes.
 */
export function CustomWidgetPanel({ widget }: { widget: CustomWidgetMeta }) {
    const { response, error, loading } = useWidgetData(widget.id, widget.refresh_interval_seconds);
    const type = response?.type ?? widget.type;

    if (type === 'kpi') {
        if (loading) {
            return <div className="h-full w-full animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />;
        }
        if (error) {
            return (
                <div className="flex h-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    {error}
                </div>
            );
        }
        return <DynamicChart type={type} data={response?.data} config={response?.chart_config} title={response?.title ?? widget.title} />;
    }

    return (
        <Card className="flex h-full flex-col">
            <CardHeader title={widget.title} />
            <div className="mt-4 min-h-0 w-full flex-1">
                {loading ? (
                    <p className="flex h-full items-center justify-center text-sm text-slate-400">Cargando…</p>
                ) : error ? (
                    <p className="flex h-full items-center justify-center text-sm text-rose-500">{error}</p>
                ) : (
                    <DynamicChart type={type} data={response?.data} config={response?.chart_config} title={widget.title} />
                )}
            </div>
        </Card>
    );
}

export default CustomWidgetPanel;
