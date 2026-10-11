'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import type { PortfolioValueHistory, PortfolioValuePoint } from '@/types';

// Bir dönemin yükleme durumu
export type ValueHistoryState =
    | { status: 'loading' }
    | { status: 'ready'; data: PortfolioValueHistory }
    | { status: 'unavailable' } // sunucuda uç nokta yok (404)
    | { status: 'error' };

type LoadedState = Exclude<ValueHistoryState, { status: 'loading' }>;

// Geçerli bir nokta mı: zaman ve değer okunabiliyor
function isValidPoint(p: PortfolioValuePoint | null | undefined): p is PortfolioValuePoint {
    return !!p && typeof p.t === 'string' && !isNaN(new Date(p.t).getTime()) && Number.isFinite(p.value);
}

function cleanPoint(p: PortfolioValuePoint): PortfolioValuePoint {
    return {
        t: p.t,
        value: p.value,
        cost: Number.isFinite(p.cost) ? p.cost : 0,
        pnl: Number.isFinite(p.pnl) ? p.pnl : 0,
    };
}

// Bozuk ya da eksik noktaları ayıklar, noktaları zamana göre sıralar
function normalize(raw: PortfolioValueHistory): PortfolioValueHistory {
    const points: PortfolioValuePoint[] = (Array.isArray(raw?.points) ? raw.points : [])
        .filter(isValidPoint)
        .map(cleanPoint)
        .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

    return {
        ...raw,
        points,
        baseline: isValidPoint(raw?.baseline) ? cleanPoint(raw.baseline) : null,
        pnl_change: Number.isFinite(raw?.pnl_change) ? raw.pnl_change : 0,
        pnl_change_pct: Number.isFinite(raw?.pnl_change_pct) ? raw.pnl_change_pct : 0,
    };
}

const NO_EXTRA: readonly string[] = [];
const LOADING: ValueHistoryState = { status: 'loading' };

// Portföyün gerçek değer geçmişi (GET /portfolio/value-history). Her dönem bir kez çekilir ve saklanır;
// refresh() saklananları atar, seçili dönem yeniden çekilir.
// alwaysLoad: seçili dönemden bağımsız hep yüklenen dönemler (ör. üstteki "Bugün" için 1D); stateFor ile okunur.
export function usePortfolioValueHistory(
    range: string,
    enabled: boolean,
    alwaysLoad: readonly string[] = NO_EXTRA,
): { state: ValueHistoryState; stateFor: (range: string) => ValueHistoryState; refresh: () => void } {
    // Yenilemede artar; eski isteklerin cevabı yeni nesle karışmasın diye anahtarın parçası
    const [generation, setGeneration] = useState(0);
    const [entries, setEntries] = useState<Record<string, LoadedState>>({});
    const inFlight = useRef(new Set<string>());

    // Dizi her çizimde yeni olabilir; efekt metin anahtara bağlı
    const extraKey = alwaysLoad.join(',');

    useEffect(() => {
        if (!enabled) return;
        const pending = inFlight.current;
        const wanted = Array.from(new Set([range, ...(extraKey ? extraKey.split(',') : [])]));
        for (const r of wanted) {
            const key = `${generation}:${r}`;
            if (entries[key] || pending.has(key)) continue;
            pending.add(key);

            api.get<PortfolioValueHistory>('/portfolio/value-history', { params: { range: r } })
                .then(res => {
                    const data = normalize(res.data);
                    setEntries(prev => ({ ...prev, [key]: { status: 'ready', data } }));
                })
                .catch(err => {
                    // Uç nokta henüz yayında değilse grafik boş durumda kalır, sayfa çökmez
                    const httpStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
                    setEntries(prev => ({ ...prev, [key]: { status: httpStatus === 404 ? 'unavailable' : 'error' } }));
                })
                .finally(() => {
                    pending.delete(key);
                });
        }
    }, [enabled, entries, generation, range, extraKey]);

    const refresh = useCallback(() => {
        setEntries({});
        setGeneration(g => g + 1);
    }, []);

    const stateFor = useCallback(
        (r: string): ValueHistoryState => entries[`${generation}:${r}`] ?? LOADING,
        [entries, generation],
    );

    return { state: stateFor(range), stateFor, refresh };
}
