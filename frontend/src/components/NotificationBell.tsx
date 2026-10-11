'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { normalizeAlert } from '@/lib/normalize';
import type { NormalizedAlert, RawPriceAlert } from '@/types';
import NotificationItem from '@/components/NotificationItem';
import IconButton from '@/components/ui/IconButton';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { buttonClasses } from '@/components/ui/Button';
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
            <IconButton
                size="sm"
                onClick={toggleDropdown}
                active={isOpen}
                title="Bildirimler"
                label="Bildirimler"
                aria-expanded={isOpen}
                icon={
                    <>
                        <Bell />
                        {/* Görülmemiş bildirim sayısı */}
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 flex items-center justify-center min-w-5 h-5 px-1 rounded-full font-mono text-xs font-medium leading-none bg-loss text-on-primary">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </>
                }
            />

            {isOpen && (
                // Mobilde ekran kenarlarına sabitlenir, geniş ekranda çanın altında açılır
                <div className="fixed inset-x-4 top-17 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem] z-50 flex flex-col overflow-hidden bg-surface border border-border-strong rounded-md">
                    <div className="flex items-center justify-between gap-2 min-h-12 pl-4 pr-1 py-1 border-b border-border">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base font-semibold text-fg">
                                Tetiklenen alarmlar
                            </span>
                            {unreadCount > 0 && <Badge tone="loss">{unreadCount} yeni</Badge>}
                        </div>

                        <div className="flex items-center gap-1">
                            {triggeredAlerts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={markAllAsSeen}
                                    className="flex items-center gap-1.5 h-11 sm:h-10 px-2.5 rounded text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors duration-[120ms] cursor-pointer"
                                    title="Tümünü okundu say"
                                >
                                    <CheckCheck className="size-4" aria-hidden />
                                    <span>Okundu</span>
                                </button>
                            )}
                            <IconButton
                                icon={<X />}
                                label="Kapat"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                            />
                        </div>
                    </div>

                    <div className="max-h-[60dvh] sm:max-h-96 overflow-y-auto flex flex-col divide-y divide-border custom-scrollbar">
                        {loading && triggeredAlerts.length === 0 ? (
                            <div className="py-8 text-center text-sm text-fg-muted">
                                Alarmlar kontrol ediliyor...
                            </div>
                        ) : triggeredAlerts.length === 0 ? (
                            <EmptyState
                                className="py-8"
                                icon={<Bell />}
                                title="Henüz tetiklenen alarm yok"
                                description="Alarm kurduğunuz bir varlık hedef fiyata ulaştığında burada görünür."
                                action={
                                    <Link
                                        href="/alerts"
                                        onClick={() => setIsOpen(false)}
                                        className={buttonClasses({ variant: 'primary', size: 'sm' })}
                                    >
                                        <Plus />
                                        <span>Alarm kur</span>
                                    </Link>
                                }
                            />
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

                    {/* Boş durumda "Alarm kur" düğmesi aynı sayfaya gittiği için bu bağlantı yalnızca liste varken görünür */}
                    {triggeredAlerts.length > 0 && (
                        <div className="p-1 border-t border-border">
                            <Link
                                href="/alerts"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-between w-full h-11 sm:h-10 px-3 rounded text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors duration-[120ms]"
                            >
                                <span>Alarmları yönet</span>
                                <ExternalLink className="size-4" aria-hidden />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
