'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { CatalogAsset } from '@/data/homeData';
import HeroSearch from '@/components/home/HeroSearch';
import MarketBoard from '@/components/home/MarketBoard';
import MarketTicker from '@/components/home/MarketTicker';
import PortfolioShowcase from '@/components/home/PortfolioShowcase';
import FeatureCardsSection from '@/components/home/FeatureCardsSection';
import FaqSection from '@/components/home/FaqSection';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageContainer from '@/components/ui/PageContainer';

export default function Home() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Giriş yapmış kullanıcıyı panele yönlendir
    useEffect(() => {
        if (!authLoading && user) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const [assets, setAssets] = useState<CatalogAsset[]>([]);

    // Varlık kataloğunu /api/assets'ten al, 20 saniyede bir yenile
    useEffect(() => {
        let isMounted = true;

        const loadAssetsFromDB = async () => {
            try {
                const res = await fetch('/api/assets', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && Array.isArray(data) && data.length > 0) {
                        setAssets(data);
                    }
                }
            } catch (err) {
                console.error('Veritabanından varlıklar alınamadı:', err);
            }
        };

        loadAssetsFromDB();
        const timer = setInterval(loadAssetsFromDB, 20000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

    if (!authLoading && user) {
        return (
            <div className="flex min-h-[60vh] flex-1 items-center justify-center">
                <LoadingSpinner fullScreen={false} message="Portföyünüze yönlendiriliyorsunuz..." />
            </div>
        );
    }

    return (
        <PageContainer className="flex-1 overflow-x-clip">
            {/* Giriş: sayfanın tek odağı olan büyük başlık ve arama; yanda dar sütunda piyasa özeti */}
            <div className="flex flex-col gap-8 lg:gap-10">
                <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
                    <section className="flex min-w-0 flex-col gap-5 lg:basis-0 lg:grow lg:pt-2">
                        <h1 className="max-w-[18ch] font-display text-[2.375rem] font-bold leading-[1.05] tracking-display text-fg text-balance sm:text-5xl lg:text-hero">
                            Hisse, fon ve altın portföyünüz tek ekranda
                        </h1>

                        <p className="max-w-xl text-base leading-relaxed text-fg-muted text-pretty">
                            İşlemlerinizi kaydedin; ortalama maliyetinizi, kâr/zararınızı ve temettülerinizi
                            TL ya da dolar karşılığıyla görün.
                        </p>

                        <div className="flex w-full pt-1">
                            <HeroSearch assets={assets} />
                        </div>
                    </section>

                    <MarketBoard assets={assets} className="w-full lg:w-[340px] lg:shrink-0" />
                </div>

                {/* Kayan fiyat şeridi, giriş ile örnek portföy arasında ince bir ayraç gibi durur */}
                <MarketTicker assets={assets} />
            </div>

            <PortfolioShowcase />

            <FeatureCardsSection />

            <FaqSection />
        </PageContainer>
    );
}
