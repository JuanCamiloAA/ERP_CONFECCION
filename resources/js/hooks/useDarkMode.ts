import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useDarkMode() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = localStorage.getItem('theme') as Theme | null;
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const applyTheme = useCallback((next: Theme) => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        if (next === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        try {
            localStorage.setItem('theme', next);
        } catch {
            // ignore
        }
        applyTheme(next);
    }, [applyTheme]);

    const toggle = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    useEffect(() => {
        applyTheme(theme);
    }, [theme, applyTheme]);

    return { theme, isDark: theme === 'dark', setTheme, toggle };
}
