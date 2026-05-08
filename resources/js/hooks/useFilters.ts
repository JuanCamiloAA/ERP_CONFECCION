import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type FiltersValue = Record<string, string | number | null | undefined>;

interface Options {
    routeName?: string;
    debounceMs?: number;
    only?: string[];
    preserveScroll?: boolean;
}

export function useFilters<T extends FiltersValue>(initial: T, options: Options = {}) {
    const { debounceMs = 300, only, preserveScroll = true, routeName } = options;
    const [filters, setFilters] = useState<T>(initial);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstRun = useRef(true);

    const applyFilters = useCallback(
        (next: T) => {
            const params = Object.entries(next).reduce<Record<string, string>>((acc, [key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    acc[key] = String(value);
                }
                return acc;
            }, {});

            const url = routeName ? route(routeName) : window.location.pathname;

            router.get(url, params, {
                preserveScroll,
                preserveState: true,
                replace: true,
                only: only as never,
            });
        },
        [routeName, preserveScroll, only],
    );

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => applyFilters(filters), debounceMs);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [filters, debounceMs, applyFilters]);

    const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const reset = useCallback(() => {
        setFilters(initial);
    }, [initial]);

    return { filters, setFilter, setFilters, reset };
}
