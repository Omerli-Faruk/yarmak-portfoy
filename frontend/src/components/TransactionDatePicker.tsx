'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Zap, AlertTriangle } from 'lucide-react';

interface TransactionDatePickerProps {
    value: string; // ISO string or 'YYYY-MM-DDTHH:mm'
    onChange: (isoString: string) => void;
    onErrorChange?: (hasError: boolean) => void;
}

export default function TransactionDatePicker({ value, onChange, onErrorChange }: TransactionDatePickerProps) {
    // Helper to get local YYYY-MM-DD
    const getLocalDateStr = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper to get local HH:mm
    const getLocalTimeStr = (d: Date): string => {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowTimeStr = getLocalTimeStr(now);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);

    // Son Borsa Seans Günü (Cuma veya önceki iş günü)
    const getLastTradingDay = (): string => {
        const d = new Date();
        const day = d.getDay(); // 0 = Pazar, 6 = Cumartesi, 1 = Pazartesi
        if (day === 0) { // Pazar -> Cuma
            d.setDate(d.getDate() - 2);
        } else if (day === 6) { // Cumartesi -> Cuma
            d.setDate(d.getDate() - 1);
        } else if (day === 1 && d.getHours() < 10) { // Pazartesi sabah seans öncesi -> Cuma
            d.setDate(d.getDate() - 3);
        } else {
            d.setDate(d.getDate() - 1);
        }
        return getLocalDateStr(d);
    };
    const lastTradingDayStr = getLastTradingDay();

    // Parse incoming value with future prevention
    const parseValue = (val: string) => {
        const d = val ? new Date(val) : new Date();
        if (isNaN(d.getTime())) {
            return {
                date: todayStr,
                time: nowTimeStr,
            };
        }
        let dateVal = getLocalDateStr(d);
        let timeVal = getLocalTimeStr(d);

        // Gelecek tarihli ise bugüne ve şu anki saate çek
        if (dateVal > todayStr) {
            dateVal = todayStr;
            timeVal = nowTimeStr;
        } else if (dateVal === todayStr && timeVal > nowTimeStr) {
            timeVal = nowTimeStr;
        }

        return {
            date: dateVal,
            time: timeVal,
        };
    };

    const initial = parseValue(value);
    const [currentDate, setCurrentDate] = useState(initial.date);
    const [currentTime, setCurrentTime] = useState(initial.time);

    const isToday = currentDate === todayStr;
    const is10FutureToday = isToday && nowTimeStr < '10:00';
    const is18FutureToday = isToday && nowTimeStr < '18:00';

    const isFuture = (currentDate > todayStr) || (isToday && currentTime > nowTimeStr);

    useEffect(() => {
        onErrorChange?.(isFuture);
    }, [isFuture, onErrorChange]);

    // Sync state if value prop changes externally
    useEffect(() => {
        const parsed = parseValue(value);
        setCurrentDate(parsed.date);
        setCurrentTime(parsed.time);
    }, [value]);

    // Emit combined ISO
    const emitChange = (newDate: string, newTime: string) => {
        try {
            // Gelecek kontrolü ve sınırlandırma
            let safeDate = newDate;
            let safeTime = newTime;
            const currentNowTime = getLocalTimeStr(new Date());

            if (safeDate > todayStr) {
                safeDate = todayStr;
            }
            if (safeDate === todayStr && safeTime > currentNowTime) {
                safeTime = currentNowTime;
            }

            const [y, m, d] = safeDate.split('-').map(Number);
            const [hh, mm] = safeTime.split(':').map(Number);
            const combined = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
            onChange(combined.toISOString());
        } catch {
            onChange(new Date().toISOString());
        }
    };

    const handleDateChange = (newDate: string) => {
        let safeDate = newDate;
        if (safeDate > todayStr) {
            safeDate = todayStr;
        }
        let safeTime = currentTime;
        const currentNowTime = getLocalTimeStr(new Date());
        if (safeDate === todayStr && safeTime > currentNowTime) {
            safeTime = currentNowTime;
            setCurrentTime(safeTime);
        }
        setCurrentDate(safeDate);
        emitChange(safeDate, safeTime);
    };

    const handleTimeChange = (newTime: string) => {
        let safeTime = newTime;
        const currentNowTime = getLocalTimeStr(new Date());
        if (currentDate === todayStr && safeTime > currentNowTime) {
            safeTime = currentNowTime;
        }
        setCurrentTime(safeTime);
        emitChange(currentDate, safeTime);
    };

    // Format for preview badge: "21 Eylül 2026, Pzt • 14:30"
    const formatPreview = (dateStr: string, timeStr: string): string => {
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const [hh, mm] = timeStr.split(':').map(Number);
            const dateObj = new Date(y, m - 1, d, hh || 0, mm || 0);
            const formattedDate = dateObj.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                weekday: 'short',
            });
            return `${formattedDate} • ${timeStr}`;
        } catch {
            return `${dateStr} • ${timeStr}`;
        }
    };

    return (
        <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            {/* 1. TARİH SEÇİMİ */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#1A9FD3]" />
                        <span>İşlem Tarihi</span>
                    </label>

                    {/* Hızlı Tarih Butonları */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handleDateChange(todayStr)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                currentDate === todayStr
                                    ? 'bg-[#1A9FD3] text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            Bugün
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDateChange(yesterdayStr)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                currentDate === yesterdayStr
                                    ? 'bg-[#1A9FD3] text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                            Dün
                        </button>
                        {lastTradingDayStr !== yesterdayStr && lastTradingDayStr !== todayStr && (
                            <button
                                type="button"
                                onClick={() => handleDateChange(lastTradingDayStr)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                    currentDate === lastTradingDayStr
                                        ? 'bg-[#1A9FD3] text-white shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                }`}
                            >
                                Son Seans
                            </button>
                        )}
                    </div>
                </div>

                <input
                    type="date"
                    required
                    max={todayStr}
                    value={currentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#1A9FD3] focus:ring-1 focus:ring-[#1A9FD3] [color-scheme:dark] cursor-pointer"
                />
            </div>

            {/* 2. SAAT SEÇİMİ */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#1A9FD3]" />
                        <span>İşlem Saati</span>
                    </label>

                    {/* Hızlı Saat Butonları */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => handleTimeChange(getLocalTimeStr(new Date()))}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 hover:text-[#1A9FD3] hover:bg-slate-700 transition cursor-pointer"
                            title="Şu anki güncel saati seç"
                        >
                            Şimdi
                        </button>
                        <button
                            type="button"
                            disabled={is10FutureToday}
                            onClick={() => handleTimeChange('10:00')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                is10FutureToday
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800/50 text-slate-600'
                                    : currentTime === '10:00'
                                        ? 'bg-[#1A9FD3] text-white shadow-sm cursor-pointer'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 cursor-pointer'
                            }`}
                            title={is10FutureToday ? "Bugün seans açılış saati (10:00) henüz gelmedi" : "Borsa İstanbul Açılışı (10:00)"}
                        >
                            10:00 Açılış
                        </button>
                        <button
                            type="button"
                            disabled={is18FutureToday}
                            onClick={() => handleTimeChange('18:00')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                is18FutureToday
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800/50 text-slate-600'
                                    : currentTime === '18:00'
                                        ? 'bg-[#1A9FD3] text-white shadow-sm cursor-pointer'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 cursor-pointer'
                            }`}
                            title={is18FutureToday ? "Bugün seans kapanış saati (18:00) henüz gelmedi" : "Borsa İstanbul Kapanışı (18:00)"}
                        >
                            18:00 Kapanış
                        </button>
                    </div>
                </div>

                <input
                    type="time"
                    required
                    max={isToday ? nowTimeStr : undefined}
                    value={currentTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#1A9FD3] focus:ring-1 focus:ring-[#1A9FD3] [color-scheme:dark] cursor-pointer"
                />
            </div>

            {/* Gelecek Zaman Uyarısı */}
            {isFuture && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Gelecek tarih veya saat seçilemez! Lütfen geçmiş veya güncel bir zaman seçin.</span>
                </div>
            )}

            {/* 3. ÖZET ROZETİ */}
            {!isFuture && (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[#1A9FD3]" />
                        İşlem Zamanı:
                    </span>
                    <span className="font-bold text-[#1A9FD3] font-mono">
                        {formatPreview(currentDate, currentTime)}
                    </span>
                </div>
            )}
        </div>
    );
}
