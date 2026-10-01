'use client';

import { useState, useCallback } from 'react';

export type Currency = 'TRY' | 'USD';

/**
 * useCurrency hook — Manages active currency ('TRY' | 'USD') with localStorage persistence.
 * Initializes lazily to avoid cascading renders and SSR mismatch.
 */
export function useCurrency(defaultCurrency: Currency = 'TRY') {
    const [currency, setCurrencyState] = useState<Currency>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('preferred_currency');
            if (saved === 'USD' || saved === 'TRY') return saved;
        }
        return defaultCurrency;
    });

    const setCurrency = useCallback((next: Currency) => {
        setCurrencyState(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferred_currency', next);
        }
    }, []);

    const toggleCurrency = useCallback(() => {
        setCurrencyState(prev => {
            const next = prev === 'TRY' ? 'USD' : 'TRY';
            if (typeof window !== 'undefined') {
                localStorage.setItem('preferred_currency', next);
            }
            return next;
        });
    }, []);

    return { currency, setCurrency, toggleCurrency };
}
