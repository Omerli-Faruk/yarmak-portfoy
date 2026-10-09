'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { CatalogAsset } from '@/data/homeData';
import HeroSearch from '@/components/home/HeroSearch';
import MarketTicker from '@/components/home/MarketTicker';
import PortfolioShowcase from '@/components/home/PortfolioShowcase';
import FeatureCardsSection from '@/components/home/FeatureCardsSection';
import FaqSection from '@/components/home/FaqSection';

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
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <span className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-mono">Portföyünüze yönlendiriliyorsunuz...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-start w-full overflow-hidden">
            {/* Giriş bölümü: başlık, arama ve örnek portföy */}
            <section className="w-full max-w-6xl mx-auto px-4 pt-12 pb-12 flex flex-col items-center text-center">
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
                    Hisse, fon ve altın portföyünüz tek ekranda
                </h1>

                <p className="text-slate-400 text-sm sm:text-base max-w-2xl mt-5 leading-relaxed">
                    BIST hisseleri, TEFAS fonları ve altın işlemlerinizi kaydedin; ortalama maliyetinizi,
                    kâr/zararınızı ve temettülerinizi TL ya da dolar karşılığıyla görün.
                </p>

                <HeroSearch assets={assets} />

                <PortfolioShowcase />
            </section>

            <MarketTicker assets={assets} />

            <FeatureCardsSection />

            <FaqSection />
        </div>
    );
}
