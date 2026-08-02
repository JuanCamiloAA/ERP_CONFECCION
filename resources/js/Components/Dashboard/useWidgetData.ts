import axios from 'axios';
import { useEffect, useState } from 'react';
import type { WidgetDataPayload, WidgetType } from '@/Components/DashboardBuilder/dashboard-builder-types';

export interface WidgetResponse {
    type: WidgetType;
    title: string;
    chart_config: Record<string, unknown> | null;
    data: WidgetDataPayload;
}

export function useWidgetData(widgetId: number, refreshIntervalSeconds: number) {
    const [response, setResponse] = useState<WidgetResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const { data } = await axios.get<WidgetResponse>(route('dashboard.widgets.data', widgetId));
                if (!cancelled) {
                    setResponse(data);
                    setError(null);
                }
            } catch {
                if (!cancelled) {
                    setError('No se pudo cargar este informe.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        const intervalMs = Math.max(15, refreshIntervalSeconds) * 1000;
        const interval = window.setInterval(load, intervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgetId]);

    return { response, error, loading };
}
