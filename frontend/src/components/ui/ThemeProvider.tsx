'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme | null {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return value === 'dark' || value === 'light' ? value : null;
    } catch {
        return null;
    }
}

function getSystemTheme(): Theme {
    try {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

function applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// Geçerli tema doğrudan <html data-theme> özniteliğinden okunur; böylece başlangıç betiğiyle hep uyumlu kalır
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
}

function getSnapshot(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function getServerSnapshot(): Theme {
    return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Geliştirme modunda React <html> özniteliklerini sıfırlayabildiği için tema yeniden uygulanır.
    // Kullanıcı seçim yapmadıysa sistem tercihi değiştiğinde tema da değişir.
    useLayoutEffect(() => {
        applyTheme(readStoredTheme() ?? getSystemTheme());

        let media: MediaQueryList;
        try {
            media = window.matchMedia('(prefers-color-scheme: light)');
        } catch {
            return;
        }
        const handleSystemChange = () => {
            if (!readStoredTheme()) applyTheme(getSystemTheme());
        };
        media.addEventListener('change', handleSystemChange);
        return () => media.removeEventListener('change', handleSystemChange);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // localStorage kullanılamıyorsa seçim yalnızca bu sayfada geçerli olur
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(getSnapshot() === 'dark' ? 'light' : 'dark');
    }, [setTheme]);

    const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme, ThemeProvider içinde kullanılmalı');
    return ctx;
}
