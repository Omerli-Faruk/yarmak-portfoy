'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import {
    Search,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Sparkles,
    ChevronDown,
    Activity,
    Bell,
    X,
    Shield,
    Globe,
    LineChart,
    Clock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   MODEL & BAŞLANGIÇ VERİLERİ
   ═══════════════════════════════════════════════════════════════ */
interface Asset {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    current_price: string;
    change: string;
    positive: boolean;
}

 function cleanText(text: string): string {
    return (text || '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .trim();
}


const featureCards = [
    {
        icon: Globe,
        title: 'Hisse, Fon ve Altın Tek Yerde',
        desc: 'BIST hisseleri, TEFAS yatırım fonları ve gram altını tek bir panelden takip edin. Farklı banka ve aracı kurum uygulamaları arasında kaybolmaya son.',
    },
    {
        icon: LineChart,
        title: 'Gerçek Zamanlı Dolar Bazlı Getiri',
        desc: 'Portföyünüzün TL performansı yanıltıcı olabilir. USD/TRY kuru ile anlık çevrim yaparak enflasyondan arındırılmış gerçek satın alma gücünüzü görün.',
    },
    {
        icon: Clock,
        title: 'Bedelsiz & Temettü Otomasyonu',
        desc: 'Sermaye artırımı sonrası lot sayınız ve birim maliyetiniz matematiksel olarak düzeltilir. Temettü ödemeleriniz brüt/net ayrımıyla kayıt altında tutulur.',
    },
    {
        icon: Activity,
        title: 'Hassas AOF Maliyet Hesabı',
        desc: 'Ağırlıklı ortalama fiyat (AOF) formülüyle her kademeli alım-satım ve komisyon gideri maliyetinize kuruşu kuruşuna doğru yansıtılır.',
    },
    {
        icon: Bell,
        title: 'Akıllı Fiyat Alarmları',
        desc: 'Hedef fiyat veya zarar-kes (stop-loss) seviyeleri belirleyin. Piyasa belirlediğiniz noktaya ulaştığında anında bildirim alın.',
    },
    {
        icon: Shield,
        title: 'Banka Şifresi ve Yetki İstemiyoruz',
        desc: 'Hiçbir finansal hesabınıza erişim veya şifre talep etmiyoruz. Sadece işlemlerinizi kaydedin, tüm profesyonel analitiği biz hesaplayalım.',
    },
];

const faqItems = [
    {
        question: 'Yarmak tam olarak ne yapıyor?',
        answer: 'Yarmak, bireysel yatırımcıların BIST hisseleri, TEFAS fonları ve altın pozisyonlarını tek bir panelde izlemesini sağlayan modern bir portföy takip terminalidir. Alım-satım, temettü ve bedelsiz bölünme işlemlerinizi girdiğinizde toplam kâr/zarar, maliyet ve getiri oranlarınızı otomatik hesaplar.',
    },
    {
        question: 'Piyasa fiyatları ne sıklıkla güncelleniyor?',
        answer: 'Arka planda çalışan entegre veri tarayıcımız (Scraper Worker), Borsa İstanbul hisseleri, altın ve kurları periyodik aralıklarla veritabanında günceller. TEFAS fon fiyatları ise her iş günü resmi takas kaynaklarından çekilerek portföyünüze yansıtılır.',
    },
    {
        question: 'Finansal verilerim güvende mi?',
        answer: 'Kesinlikle evet. Banka, MKK veya aracı kurum şifreleriniz asla talep edilmez. Tüm veri trafiği endüstri standardı şifreleme protokolleriyle (HTTPS/TLS) korunur ve yalnızca sizin sisteme girdiğiniz lot/işlem kayıtları saklanır.',
    },
    {
        question: 'Dolar bazlı portföy değeri nasıl hesaplanıyor?',
        answer: 'Portföyünüzdeki her bir varlığın toplam TL değeri anlık USD/TRY kuru ile bölünerek dinamik olarak dolara çevrilir. Bu sayede kur hareketlerinin portföyünüze gerçek etkisini anlık grafiklerle izleyebilirsiniz.',
    },
    {
        question: 'Bedelsiz bölünmeler portföyüme nasıl yansır?',
        answer: 'Şirketlerin bedelsiz sermaye artırımı gerçekleştiğinde sistem bunu otomatik olarak algılar; lot miktarınızı oran kadar artırırken hisse başı ortalama maliyetinizi aynı oranda düşürür. Toplam yatırım maliyetiniz bozulmaz.',
    },
    {
        question: 'Yarmak ücretli mi olacak?',
        answer: 'Hayır, Yarmak bireysel yatırımcılar için temel ve profesyonel portföy takip özellikleriyle tamamen ücretsiz olarak sunulmaktadır. Amacımız Türkiye sermaye piyasalarında kaliteli bir yatırım deneyimi oluşturmaktır.',
    },
];


/* ═══════════════════════════════════════════════════════════════
   ANA SAYFA BİLEŞENİ
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
    const [searchQuery, setSearchQuery] = useState('');
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dynamicMatches, setDynamicMatches] = useState<Asset[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isLiveConnected, setIsLiveConnected] = useState(false);

    const searchRef = useRef<HTMLDivElement>(null);

    // Veritabanından /api/assets üzerinden canlı varlık kataloğunu çek
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
                if (isMounted) setIsLoading(false);
            }
        };

        loadAssetsFromDB();
        const timer = setInterval(loadAssetsFromDB, 20000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

    // Arama kutusuna yazıldığında dinamik piyasa keşfi yap (BIST veya TEFAS'taki her şeyi bulur)
    useEffect(() => {
        const q = searchQuery.trim();
        const timeout = setTimeout(async () => {
            if (q.length < 2) {
                setDynamicMatches([]);
                return;
            }
            try {
                const res = await fetch(`/api/assets?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setDynamicMatches(data);
                    }
                }
            } catch {
                // Hata durumunda yerel filtre devam eder
            }
        }, 150);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Arama dışına tıklayınca kapatma
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fiyat formatlayıcı
    const fmt = useCallback((priceStr: string | number) => {
        const num = typeof priceStr === 'string' ? parseFloat(priceStr) : priceStr;
        if (isNaN(num)) return '—';
        return num.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }, []);

    // Gelişmiş Arama Filtresi (Veritabanı + Canlı Dinamik Keşif Birleşimi)
    const searchResults = useMemo(() => {
        const raw = searchQuery.trim();
        const q = cleanText(raw);

        if (!q) {
            // Arama boşken öne çıkan popüler varlıklar
            return assets.filter((a) => ['ASELS', 'TUPRS', 'THYAO', 'ALTIN', 'XU100', 'USDTRY'].includes(a.symbol)).slice(0, 6);
        }

        // 1. Yerel veritabanı filtrelemesi
        const localMatches = assets.filter((a) => {
            const sym = cleanText(a.symbol);
            const name = cleanText(a.name);

            if (sym.includes(q)) return true;
            if (name.includes(q)) return true;
            if (q.includes(sym) && sym.length >= 3) return true;

            // Kelime bazlı eşleme (örn: "quick sigorta" yazıldığında her kelime eşleşmesi)
            const words = q.split(/\s+/).filter(Boolean);
            if (words.length > 1 && words.every((w) => sym.includes(w) || name.includes(w))) {
                return true;
            }

            return false;
        });

        // 2. Dinamik piyasa aramasından gelenleri yerel ile tekilleştirerek birleştir
        const combinedMap = new Map<string, Asset>();
        localMatches.forEach((a) => combinedMap.set(a.symbol, a));
        dynamicMatches.forEach((a) => {
            if (!combinedMap.has(a.symbol)) {
                combinedMap.set(a.symbol, a);
            }
        });

        // Eşleşme alaka düzeyine göre sırala (Tam sembol eşleşmesi en başta)
        return Array.from(combinedMap.values())
            .sort((a, b) => {
                const aSym = cleanText(a.symbol);
                const bSym = cleanText(b.symbol);
                if (aSym === q && bSym !== q) return -1;
                if (bSym === q && aSym !== q) return 1;
                if (aSym.startsWith(q) && !bSym.startsWith(q)) return -1;
                if (bSym.startsWith(q) && !aSym.startsWith(q)) return 1;
                return 0;
            })
            .slice(0, 8);
    }, [searchQuery, assets, dynamicMatches]);

    // Canlı Kayan Şerit (Animated Marquee Ticker Slider) - Tamamen Dinamik (Sıfır Statik Fiyat)
    const sliderItems = useMemo(() => {
        if (assets.length === 0) return [];

        // Kullanıcının talep ettiği tam sıralama:
        // dolar, euro, bist100, bist30, altın gram, koç holding, sasa, thyao, aselsan, tüpraş, astor
        const SLIDER_CONFIG: { symbol: string; label: string; type: string }[] = [
            { symbol: 'USDTRY', label: 'Dolar', type: 'flag_us' },
            { symbol: 'EURTRY', label: 'Euro', type: 'flag_eu' },
            { symbol: 'XU100', label: 'BIST 100', type: 'text' },
            { symbol: 'XU030', label: 'BIST 30', type: 'text' },
            { symbol: 'ALTIN', label: 'Gram Altın', type: 'gold' },
            { symbol: 'KCHOL', label: 'Koç Holding', type: 'stock' },
            { symbol: 'SASA', label: 'SASA', type: 'stock' },
            { symbol: 'THYAO', label: 'THYAO', type: 'stock' },
            { symbol: 'ASELS', label: 'Aselsan', type: 'stock' },
            { symbol: 'TUPRS', label: 'Tüpraş', type: 'stock' },
            { symbol: 'ASTOR', label: 'ASTOR', type: 'stock' },
        ];

        const items: { id: string; label: string; price: string; change: string; positive: boolean; type: string }[] = [];

        SLIDER_CONFIG.forEach((cfg) => {
            const asset = assets.find((a) => a.symbol === cfg.symbol);
            if (asset && parseFloat(asset.current_price) > 0) {
                const chg = asset.change || '+0.00';
                const formattedChange = (chg.startsWith('+') || chg.startsWith('-') ? chg : '+' + chg) + '%';
                items.push({
                    id: cfg.symbol.toLowerCase(),
                    label: cfg.label,
                    price: fmt(asset.current_price),
                    change: formattedChange,
                    positive: asset.positive,
                    type: cfg.type,
                });
            }
        });

        return items;
    }, [assets, fmt]);

    const bistAsset = assets.find((a) => a.symbol === 'XU100');
    const usdAsset = assets.find((a) => a.symbol === 'USDTRY');
    const eurAsset = assets.find((a) => a.symbol === 'EURTRY');
    const goldAsset = assets.find((a) => a.symbol === 'ALTIN');

    return (
        <div className="flex-1 flex flex-col items-center justify-start w-full overflow-hidden">
            {/* ═══════════════ 1. HERO BÖLÜMÜ ═══════════════ */}
            <section className="w-full max-w-6xl mx-auto px-4 pt-12 pb-12 flex flex-col items-center text-center">

                <motion.h1
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.05 }}
                    className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]"
                >
                    Tarihin İlk Parasından{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-300">
                        Geleceğin Akıllı Portföyüne
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.1 }}
                    className="text-slate-400 text-sm sm:text-base max-w-2xl mt-5 leading-relaxed"
                >
                    BIST hisseleri, TEFAS fonları ve altın yatırımlarınızı tek çatı altında
                    profesyonelce yönetin; kâr ve zararınızı anlık Dolar ve TL bazında izleyin.
                </motion.p>

                {/* ——— ARAMA ÇUBUĞU (BIST & TEFAS CANLI DESTEKLİ) ——— */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.15 }}
                    className="w-full max-w-xl mt-9 relative z-50"
                    ref={searchRef}
                >
                    <div
                        className={`flex items-center gap-3 bg-[#131924]/90 backdrop-blur-xl border ${
                            isSearchFocused
                                ? 'border-primary shadow-[0_0_25px_rgba(26,159,211,0.25)] ring-1 ring-primary/40'
                                : 'border-border/80 shadow-xl shadow-black/50 hover:border-slate-600'
                        } rounded-full px-5 py-3.5 transition-all duration-200`}
                    >
                        <Search
                            className={`size-5 shrink-0 transition-colors ${
                                isSearchFocused ? 'text-primary' : 'text-slate-400'
                            }`}
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (!isSearchFocused) setIsSearchFocused(true);
                            }}
                            onFocus={() => setIsSearchFocused(true)}
                            placeholder="BIST hissesi veya TEFAS fonu ara (örn: intetra, tly, thy)..."
                            className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                                aria-label="Temizle"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                        <Link
                            href="/register"
                            className="bg-primary hover:bg-primary-hover text-slate-950 text-xs font-semibold px-4 py-2 rounded-full transition shrink-0 hidden sm:flex items-center gap-1.5"
                        >
                            Keşfet <ArrowRight className="size-3.5" />
                        </Link>
                    </div>

                    {/* Canlı Autocomplete Dropdown */}
                    <AnimatePresence>
                        {isSearchFocused && (
                            <motion.div
                                initial={{ opacity: 0, y: 6, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.99 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-[#111722]/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-[70] text-left divide-y divide-border/30"
                            >
                                <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-surface/40 flex items-center justify-between">
                                    <span>{searchQuery ? `Sonuçlar (${searchResults.length})` : 'Öne Çıkan Varlıklar'}</span>
                                    <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        BIST & TEFAS CANLI
                                    </span>
                                </div>

                                {searchResults.length > 0 ? (
                                    <div className="max-h-80 overflow-y-auto divide-y divide-border/20">
                                        {searchResults.map((asset) => (
                                            <div
                                                key={asset.symbol}
                                                onClick={() => {
                                                    setSearchQuery(asset.symbol);
                                                    setIsSearchFocused(false);
                                                }}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-primary/10 transition-colors group cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-xl bg-[#1A2230] border border-border/60 flex items-center justify-center font-bold text-xs text-primary group-hover:border-primary/50 transition-colors">
                                                        {asset.symbol.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                                                {asset.symbol}
                                                            </span>
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border/50 text-slate-400 font-semibold">
                                                                {asset.asset_type}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px] sm:max-w-xs">
                                                            {asset.name}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-sm font-bold font-mono text-white">
                                                        ₺{fmt(asset.current_price)}
                                                    </div>
                                                    <div
                                                        className={`text-[11px] font-mono flex items-center justify-end gap-0.5 ${
                                                            asset.positive ? 'text-emerald-400' : 'text-rose-400'
                                                        }`}
                                                    >
                                                        {asset.positive ? (
                                                            <TrendingUp className="size-3" />
                                                        ) : (
                                                            <TrendingDown className="size-3" />
                                                        )}
                                                        <span>{asset.change}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center text-sm text-slate-400">
                                        &quot;{searchQuery}&quot; için piyasada hisse veya fon bulunamadı.
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Popüler Etiketler */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-xs">
                        <span className="text-slate-500 font-medium">Popüler:</span>
                        {[
                            { label: 'Aselsan', query: 'ASELS' },
                            { label: 'Tüpraş', query: 'TUPRS' },
                            { label: 'Türk Hava Yolları', query: 'THYAO' },
                            { label: 'Altın', query: 'ALTIN' },
                            { label: 'BIST 100', query: 'XU100' },
                        ].map((item) => (
                            <button
                                type="button"
                                key={item.query}
                                onClick={() => {
                                    setSearchQuery(item.query);
                                    setIsSearchFocused(true);
                                }}
                                className="px-3.5 py-1.5 rounded-full bg-[#131924]/60 border border-border/70 hover:border-primary/60 hover:bg-primary/10 text-slate-200 font-semibold text-xs transition shadow-sm cursor-pointer"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* ═══════════════ 2. DASHBOARD MOCKUP ═══════════════ */}
                {/* ═══════════════ 2. CANLI PİYASA TERMİNAL KARTI ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full max-w-5xl mt-10 rounded-2xl border border-border/80 bg-[#0D1117]/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-left flex flex-col"
                >
                    {/* Üst Bar: Canlı Durum ve İndeks Başlığı */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-[#0B0F15]/80">
                        <div className="flex items-center gap-2.5">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-semibold text-slate-300">Piyasa Canlı Akışı</span>
                            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">• BIST & TEFAS & FX</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {['1G', '1H', '1A', '3A', '1Y'].map((t) => (
                                <span
                                    key={t}
                                    className={`text-[10px] px-2 py-0.5 rounded font-medium cursor-default transition ${
                                        t === '1G' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Ana İçerik: Saf Flexbox Düzeni */}
                    <div className="flex flex-col lg:flex-row items-stretch gap-6 p-5 sm:p-6 bg-[#0D1117]">
                        {/* Sol Taraf: BIST 100 Canlı Grafik & Endeks */}
                        <div className="flex-1 flex flex-col justify-between bg-[#131924]/70 border border-border/50 rounded-xl p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                        XU
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-base font-bold text-white tracking-tight">Borsa İstanbul (BIST 100)</span>
                                        <span className="text-xs text-slate-400">Canlı Endeks Değeri</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xl sm:text-2xl font-black font-mono text-white">
                                        ₺{bistAsset ? fmt(bistAsset.current_price) : '—'}
                                    </span>
                                    <span className={`text-xs font-mono font-semibold flex items-center gap-1 ${bistAsset?.positive ?? true ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {bistAsset?.positive ?? true ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                                        {bistAsset ? (bistAsset.change.startsWith('+') || bistAsset.change.startsWith('-') ? bistAsset.change : '+' + bistAsset.change) : '+0.00'}%
                                    </span>
                                </div>
                            </div>

                            {/* Canlı Sparkline Grafiği */}
                            <div className="w-full h-32 mt-6">
                                <svg viewBox="0 0 400 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="liveChartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#1A9FD3" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#1A9FD3" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M0,80 Q30,70 60,65 T120,55 T180,60 T240,40 T300,35 T360,20 T400,10 L400,100 L0,100 Z"
                                        fill="url(#liveChartGrad)"
                                    />
                                    <path
                                        d="M0,80 Q30,70 60,65 T120,55 T180,60 T240,40 T300,35 T360,20 T400,10"
                                        fill="none"
                                        stroke="#1A9FD3"
                                        strokeWidth="2.5"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Sağ Taraf: Canlı Makro Varlıklar (Döviz, Altın) */}
                        <div className="w-full lg:w-80 flex flex-col justify-between gap-3 bg-[#131924]/70 border border-border/50 rounded-xl p-5">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Canlı Piyasa Göstergeleri
                            </span>

                            <div className="flex flex-col gap-2.5 my-auto">
                                {[
                                    { label: 'Dolar / TL', asset: usdAsset, flag: '🇺🇸' },
                                    { label: 'Euro / TL', asset: eurAsset, flag: '🇪🇺' },
                                    { label: 'Gram Altın', asset: goldAsset, icon: '🟡' },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-surface/30 border border-border/30 hover:border-primary/40 transition"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-sm">{item.flag || item.icon}</span>
                                            <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-right">
                                            <span className="text-xs font-bold font-mono text-white">
                                                ₺{item.asset ? fmt(item.asset.current_price) : '—'}
                                            </span>
                                            <span
                                                className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                                                    item.asset?.positive ?? true
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-rose-500/10 text-rose-400'
                                                }`}
                                            >
                                                {item.asset ? (item.asset.change.startsWith('+') || item.asset.change.startsWith('-') ? item.asset.change : '+' + item.asset.change) : '+0.00'}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Link
                                href="/register"
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-slate-950 font-bold text-xs transition shadow-lg shadow-primary/20 mt-2"
                            >
                                <span>Kendi Portföyünü Oluştur</span>
                                <ArrowRight className="size-3.5" />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════
                3. CANLI PİYASA SLIDER (Sonsuz Kayan Canlı Ticker Marquee)
                BIST 100, USD/TRY, ALTIN, TEFAS, THYAO, ASELS, INTET, TLY vb.
               ═══════════════════════════════════════════════════════════════ */}
            <section className="w-full border-y border-white/[0.08] bg-[#090D14] py-3.5 overflow-hidden flex items-center justify-center">
                {sliderItems.length > 0 ? (
                    <div className="flex w-full overflow-hidden select-none">
                        <motion.div
                            className="flex shrink-0 items-center gap-8 sm:gap-12"
                            animate={{ x: ['0%', '-50%'] }}
                            transition={{
                                repeat: Infinity,
                                repeatType: 'loop',
                                duration: 32,
                                ease: 'linear',
                            }}
                        >
                            {/* Çift döngü ile kesintisiz, akıcı sonsuz kayma */}
                            {[...sliderItems, ...sliderItems].map((item, idx) => (
                                <div key={`${item.id}-${idx}`} className="flex items-center gap-2 shrink-0 group cursor-default">
                                    {/* İkonlar */}
                                    {item.type === 'flag_us' && (
                                        <span className="text-sm sm:text-base leading-none">🇺🇸</span>
                                    )}
                                    {item.type === 'flag_eu' && (
                                        <span className="text-sm sm:text-base leading-none">🇪🇺</span>
                                    )}
                                    {item.type === 'gold' && (
                                        <div className="size-4 rounded-full bg-[#D4AF37] flex items-center justify-center text-[9px] font-extrabold text-slate-950 shadow-[0_0_6px_rgba(212,175,55,0.3)]">
                                            A
                                        </div>
                                    )}
                                    {item.type === 'tefas' && (
                                        <div className="size-4 rounded-full bg-primary flex items-center justify-center text-[9px] font-extrabold text-slate-950 shadow-[0_0_6px_rgba(26,159,211,0.35)]">
                                            T
                                        </div>
                                    )}
                                    {item.type === 'stock' && (
                                        <div className="size-4 rounded bg-surface/80 border border-border/60 flex items-center justify-center text-[9px] text-slate-400">
                                            📈
                                        </div>
                                    )}

                                    {/* Varlık Adı */}
                                    <span className="text-slate-200 font-semibold tracking-wide text-xs sm:text-[13px]">
                                        {item.label}
                                    </span>

                                    {/* Canlı Fiyat */}
                                    <span
                                        className={`font-mono font-bold text-xs sm:text-[13px] ${
                                            item.positive ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                    >
                                        ₺{item.price}
                                    </span>

                                    {/* Değişim Yüzdesi */}
                                    <span
                                        className={`font-mono text-xs sm:text-[13px] ${
                                            item.positive ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                    >
                                        {item.change}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 py-1">
                        <span className="size-2 rounded-full bg-primary animate-pulse" />
                        <span>Canlı Borsa İstanbul ve TEFAS piyasa verileri senkronize ediliyor...</span>
                    </div>
                )}
            </section>

            {/* ═══════════════ 4. NEDEN YARMAK? ═══════════════ */}
            <section className="w-full max-w-6xl mx-auto px-4 py-24 flex flex-col items-center">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4 }}
                    >
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
                            Neden Yarmak?
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            Yatırımlarınızı karmaşık Excel tablolarında mı takip ediyorsunuz, yoksa banka
                            uygulamaları arasında mı geçiş yapıyorsunuz? Artık tüm piyasalar tek ekranda.
                        </p>
                    </motion.div>
                </div>

                <div className="flex flex-wrap items-stretch justify-center gap-5 w-full">
                    {featureCards.map((feat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.35, delay: idx * 0.05 }}
                            className="group flex-1 min-w-[280px] max-w-[360px] flex flex-col p-6 rounded-2xl bg-surface/30 border border-border/40 hover:bg-surface/60 hover:border-primary/30 transition-all duration-300 overflow-hidden"
                        >
                            <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                                <feat.icon className="size-5 text-primary" />
                            </div>
                            <h3 className="text-base font-bold text-white mb-2 tracking-tight">{feat.title}</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ═══════════════ 5. SIKÇA SORULAN SORULAR ═══════════════ */}
            <section className="w-full max-w-3xl mx-auto px-4 pb-24 flex flex-col">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                        Sıkça Sorulan Sorular
                    </h2>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Yarmak&apos;ın nasıl çalıştığını ve finansal hesaplamaların nasıl yapıldığını öğrenin
                    </p>
                </motion.div>

                <div className="space-y-2.5">
                    {faqItems.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: index * 0.04 }}
                            className={`rounded-xl border overflow-hidden transition-colors duration-200 ${
                                openFaq === index
                                    ? 'border-primary/40 bg-surface/50'
                                    : 'border-border/50 bg-surface/20 hover:bg-surface/30'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                className="w-full flex items-center justify-between px-6 py-4.5 text-left cursor-pointer"
                            >
                                <span
                                    className={`text-sm font-semibold transition-colors ${
                                        openFaq === index ? 'text-white' : 'text-slate-300'
                                    }`}
                                >
                                    {item.question}
                                </span>
                                <div
                                    className={`size-7 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all duration-300 ${
                                        openFaq === index ? 'bg-primary/20 rotate-180' : 'bg-surface/80'
                                    }`}
                                >
                                    <ChevronDown
                                        className={`size-4 transition-colors ${
                                            openFaq === index ? 'text-primary' : 'text-slate-500'
                                        }`}
                                    />
                                </div>
                            </button>
                            <AnimatePresence>
                                {openFaq === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-border/30 pt-4">
                                            {item.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </section>

        </div>
    );
}
