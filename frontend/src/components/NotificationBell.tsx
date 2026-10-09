'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { normalizeAlert } from '@/lib/normalize';
import type { NormalizedAlert, RawPriceAlert } from '@/types';
import NotificationItem from '@/components/NotificationItem';
import {
    Bell,
    CheckCheck,
    ExternalLink,
    Plus,
    X
} from 'lucide-react';

export default function NotificationBell() {
    const { user } = useAuth();
    const router = useRouter();

    const [isOpen, setIsOpen] = useState(false);
    const [triggeredAlerts, setTriggeredAlerts] = useState<NormalizedAlert[]>([]);
    const [seenAlertIds, setSeenAlertIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Görülen bildirimlerin id'leri kullanıcı başına localStorage'da tutulur
    const storageKey = user ? `seen_alert_ids_${user.id}` : null;

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
            // Kayıt bozuksa yok sayılır
        }
    }, [storageKey]);

    // Alarmları çekip yalnızca tetiklenenleri tutar
    const loadAlerts = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await api.get<RawPriceAlert[]>('/alerts');
            const data = Array.isArray(res.data) ? res.data : [];

            const triggered = data.map(normalizeAlert).filter(a => a.isTriggered);

            // En son tetiklenen en üstte
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

    // İlk açılışta, 60 saniyede bir ve pencere tekrar odaklandığında yenilenir
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

    const unreadCount = triggeredAlerts.filter(a => !seenAlertIds.includes(a.id)).length;

    const markAllAsSeen = useCallback(() => {
        if (!storageKey || typeof window === 'undefined') return;
        const allIds = triggeredAlerts.map(a => a.id);
        setSeenAlertIds(allIds);
        try {
            localStorage.setItem(storageKey, JSON.stringify(allIds));
        } catch {
            // localStorage kullanılamıyorsa durum sadece bu oturumda kalır
        }
    }, [storageKey, triggeredAlerts]);

    // Panel açılınca bildirimler görüldü sayılır
    const toggleDropdown = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState && unreadCount > 0) {
            markAllAsSeen();
        }
    };

    // Panel dışına tıklanınca veya Escape'e basılınca kapanır
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

    const handleNotificationClick = (symbol: string) => {
        setIsOpen(false);
        router.push(`/assets/${encodeURIComponent(symbol)}`);
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
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

                {/* Görülmemiş bildirim sayısı */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                Fiyat Alarmları
                            </span>
                            {unreadCount > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
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
                                <p className="text-xs font-semibold text-white">Henüz tetiklenen alarm yok</p>
                                <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                                    Alarm kurduğunuz bir varlık hedef fiyata ulaştığında burada görünür. Fiyatlar gecikmeli güncellendiği için bildirim geç gelebilir.
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
                            triggeredAlerts.map(alert => (
                                <NotificationItem
                                    key={alert.id}
                                    alert={alert}
                                    wasSeen={seenAlertIds.includes(alert.id)}
                                    onClick={() => handleNotificationClick(alert.symbol)}
                                />
                            ))
                        )}
                    </div>

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
