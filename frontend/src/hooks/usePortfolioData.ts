'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { fetchAssetSummariesBulk, invalidateAssetCache } from '@/lib/assetCache';
import type {
    AssetSummaryMap,
    Dividend,
    PortfolioSummary,
    User,
    UserHolding,
} from '@/types';

interface PortfolioDataOptions {
    withDividends?: boolean;        // /dividends de yüklensin
    awaitAssetSummaries?: boolean;  // yükleniyor durumu varlık getirileri gelene kadar sürsün
}

export interface PortfolioData {
    summary: PortfolioSummary | null;
    holdings: UserHolding[];
    dividends: Dividend[];          // withDividends yoksa boş kalır
    assetSummaries: AssetSummaryMap;
    usdRate: number | null;         // backend geçerli kur döndürmezse null
    loading: boolean;
    refreshing: boolean;
    loadError: boolean;             // son yüklemede özet ya da varlık listesi alınamadı
    reload: (isManualRefresh?: boolean) => Promise<void>;
}

// Portföyüm ve Varlıklarım sayfalarının ortak veri yüklemesi.
// Kullanıcı yoksa istek atılmaz; giriş sayfasına yönlendirme sayfalarda yapılır.
export function usePortfolioData(user: User | null, opts: PortfolioDataOptions = {}): PortfolioData {
    const { withDividends = false, awaitAssetSummaries = false } = opts;

    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [holdings, setHoldings] = useState<UserHolding[]>([]);
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [assetSummaries, setAssetSummaries] = useState<AssetSummaryMap>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const reload = useCallback(async (isManualRefresh = false) => {
        try {
            setRefreshing(true);
            if (isManualRefresh) {
                invalidateAssetCache();
            }
            // Biri hata verse de diğerleri gösterilsin diye her istek kendi hatasını yutuyor
            const [sumRes, holdRes, divRes] = await Promise.all([
                api.get<PortfolioSummary>('/portfolio/summary').catch(() => null),
                api.get<UserHolding[]>('/portfolio/holdings').catch(() => null),
                withDividends ? api.get<Dividend[]>('/dividends').catch(() => null) : null,
            ]);

            setLoadError(!sumRes?.data || !holdRes?.data);
            if (sumRes?.data) setSummary(sumRes.data);
            if (divRes?.data) setDividends(divRes.data);
            if (holdRes?.data) {
                const holds = holdRes.data;
                setHoldings(holds);

                // Varlıkların periyot getirileri önbellekten ya da toplu istekle gelir
                const summariesLoad = fetchAssetSummariesBulk(holds.map(h => h.symbol), isManualRefresh)
                    .then(summaries => {
                        if (Object.keys(summaries).length > 0) {
                            setAssetSummaries(prev => ({ ...prev, ...summaries }));
                        }
                    });
                if (awaitAssetSummaries) {
                    await summariesLoad;
                } else {
                    summariesLoad.catch(() => null);
                }
            }
        } catch (err) {
            console.error('Portföy verileri yüklenemedi:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [withDividends, awaitAssetSummaries]);

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void reload();
        }
    }, [user, reload]);

    const usdRate = summary && summary.usd_rate > 0 ? summary.usd_rate : null;

    return { summary, holdings, dividends, assetSummaries, usdRate, loading, refreshing, loadError, reload };
}
