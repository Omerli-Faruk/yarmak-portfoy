'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/formatters';
import {
    Bell,
    CheckCheck,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    ExternalLink,
    Plus,
    X
} from 'lucide-react';

interface RawPriceAlert {
    ID?: number;
    id?: number;
    UserID?: number;
    user_id?: number;
    AssetID?: number;
    asset_id?: number;
    TargetPrice?: string;
    target_price?: string;
    Direction?: 'ABOVE' | 'BELOW';
    direction?: 'ABOVE' | 'BELOW';
    IsTriggered?: boolean;
    is_triggered?: boolean;
    TriggeredAt?: { Time: string; Valid: boolean } | string | null;
    triggered_at?: { Time: string; Valid: boolean } | string | null;
    CreatedAt?: string;
    created_at?: string;
    Symbol?: string;
    symbol?: string;
    AssetName?: string;
    asset_name?: string;
    CurrentPrice?: string;
    current_price?: string;
}

interface TriggeredNotification {
    id: number;
    symbol: string;
    assetName: string;
    targetPrice: number;
    currentPrice: number;
    direction: 'ABOVE' | 'BELOW';
    triggeredAt: string | null;
    isNew: boolean;
}

export default function NotificationBell() {
    const { user } = useAuth();
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(false);
    const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredNotification[]>([]);
    const [seenAlertIds, setSeenAlertIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // LocalStorage key per user
    const storageKey = user ? `seen_alert_ids_${user.id}` : null;

    // Load initial seen IDs from LocalStorage
    useEffect(() => {
        if (!storageKey || typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setSeenAlertIds(parsed.map(Number));
                }
            }
        } catch {
            // LocalStorage parse hatası olursa sessizce geç
        }
    }, [storageKey]);

    // Alarmları API'den Çek
    const loadAlerts = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await api.get<RawPriceAlert[]>('/alerts');
            const data = Array.isArray(res.data) ? res.data : [];

            // Yalnızca tetiklenen alarmları filtrele
            const triggered = data
                .filter(a => Boolean(a.IsTriggered ?? a.is_triggered))
                .map(a => {
                    const id = Number(a.ID ?? a.id ?? 0);
                    const symbol = a.Symbol ?? a.symbol ?? '';
                    const assetName = a.AssetName ?? a.asset_name ?? symbol;
                    const targetPrice = parseFloat(a.TargetPrice ?? a.target_price ?? '0') || 0;
                    const currentPrice = parseFloat(a.CurrentPrice ?? a.current_price ?? '0') || 0;
                    const direction = (a.Direction ?? a.direction ?? 'ABOVE') as 'ABOVE' | 'BELOW';

                    let triggeredAt: string | null = null;
                    const rawTriggered = a.TriggeredAt ?? a.triggered_at;
                    if (rawTriggered) {
                        if (typeof rawTriggered === 'object' && rawTriggered.Valid && rawTriggered.Time) {
                            triggeredAt = rawTriggered.Time;
                        } else if (typeof rawTriggered === 'string') {
                            triggeredAt = rawTriggered;
                        }
                    }

                    return {
                        id,
                        symbol,
                        assetName,
                        targetPrice,
                        currentPrice,
                        direction,
                        triggeredAt,
                        isNew: false, // sonraki adımda hesaplanacak
                    };
                });

            // En son tetiklenenler üstte olacak şekilde sırala
            triggered.sort((a, b) => {
                const tA = a.triggeredAt ? new Date(a.triggeredAt).getTime() : 0;
                const tB = b.triggeredAt ? new Date(b.triggeredAt).getTime() : 0;
                return tB - tA;
            });

            setTriggeredAlerts(triggered);
        } catch (err) {
            console.error('Bildirimler yüklenirken hata:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Sayfa açıldığında ve periyodik olarak çek (60 saniye)
    useEffect(() => {
        if (!user) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadAlerts();

        const interval = setInterval(() => {
            void loadAlerts();
        }, 60000);

        const handleFocus = () => {
            void loadAlerts();
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, loadAlerts]);

    // Okunmamış (henüz görülmemiş) tetiklenen alarm sayısı
    const unreadCount = triggeredAlerts.filter(a => !seenAlertIds.includes(a.id)).length;

    // Tümünü Okundu Say
    const markAllAsSeen = useCallback(() => {
        if (!storageKey || typeof window === 'undefined') return;
        const allIds = triggeredAlerts.map(a => a.id);
        setSeenAlertIds(allIds);
        try {
            localStorage.setItem(storageKey, JSON.stringify(allIds));
        } catch {
            // LocalStorage hatası
        }
    }, [storageKey, triggeredAlerts]);

    // Paneli Aç / Kapat
    const toggleDropdown = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState && unreadCount > 0) {
            // Panel açıldığında otomatik okundu say
            markAllAsSeen();
        }
    };

    // Dışarı tıklama ve Escape tuşuyla kapatma dinleyicisi
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Bildirime tıklandığında ilgili hisseye git
    const handleNotificationClick = (symbol: string) => {
        setIsOpen(false);
        router.push(`/assets/${encodeURIComponent(symbol)}`);
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* ÇAN BUTONU */}
            <button
                type="button"
                onClick={toggleDropdown}
                className={`relative p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                    isOpen
                        ? 'bg-slate-800 text-white border-slate-700'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
                title="Fiyat Alarmları ve Bildirimler"
                aria-label="Bildirimler"
                aria-expanded={isOpen}
            >
                <Bell className="w-4 h-4" />

                {/* OKUNMAMIŞ ROZETİ (BADGE) */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs animate-in zoom-in duration-200">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* AÇILIR BİLDİRİM PANELİ (DROPDOWN) */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* PANEL BAŞLIĞI */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Fiyat Alarmları
                            </span>
                            {unreadCount > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                                    {unreadCount} Yeni
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {triggeredAlerts.length} Tetiklenen
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {triggeredAlerts.length > 0 && (
                                <button
                                    onClick={markAllAsSeen}
                                    className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
                                    title="Tümünü Okundu Say"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Okundu</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-500 hover:text-white transition p-1"
                                title="Kapat"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* BİLDİRİM LİSTESİ */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                        {loading && triggeredAlerts.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-500">
                                Alarmlar kontrol ediliyor...
                            </div>
                        ) : triggeredAlerts.length === 0 ? (
                            <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
                                <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2.5">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-semibold text-white">Henüz Tetiklenen Alarm Yok</p>
                                <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                                    Hisseleriniz belirlediğiniz hedef fiyatlara ulaştığında burada anında listelenecektir.
                                </p>
                                <Link
                                    href="/alerts"
                                    onClick={() => setIsOpen(false)}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Alarm Kur</span>
                                </Link>
                            </div>
                        ) : (
                            triggeredAlerts.map(alert => {
                                const isAbove = alert.direction === 'ABOVE';
                                const wasSeen = seenAlertIds.includes(alert.id);

                                return (
                                    <div
                                        key={alert.id}
                                        onClick={() => handleNotificationClick(alert.symbol)}
                                        className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer flex items-start gap-3 group ${
                                            !wasSeen ? 'bg-slate-800/20' : ''
                                        }`}
                                    >
                                        {/* İkon */}
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-slate-600 transition">
                                            {isAbove ? (
                                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <ArrowDownRight className="w-4 h-4 text-rose-400" />
                                            )}
                                        </div>

                                        {/* İçerik */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-white font-mono group-hover:text-primary transition">
                                                        {alert.symbol}
                                                    </span>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                                        isAbove
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : 'bg-rose-500/10 text-rose-400'
                                                    }`}>
                                                        {isAbove ? 'Hedef Aşıldı' : 'Hedefin Altında'}
                                                    </span>
                                                </div>
                                                {!wasSeen && (
                                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Yeni Bildirim" />
                                                )}
                                            </div>

                                            <p className="text-[11px] text-slate-300 leading-snug">
                                                Hedeflenen <strong className="text-white font-mono">{formatMoney(alert.targetPrice)}</strong> seviyesine ulaştı.
                                            </p>

                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/40">
                                                <span>Anlık: <strong className="text-slate-200">{formatMoney(alert.currentPrice)}</strong></span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-500" />
                                                    {formatDate(alert.triggeredAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* PANEL ALTI (FOOTER) */}
                    <div className="p-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <Link
                            href="/alerts"
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white transition flex items-center gap-1.5 font-medium px-2 py-1 rounded-lg hover:bg-slate-800/60 w-full justify-between"
                        >
                            <span>Tüm Alarmları Yönet</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
