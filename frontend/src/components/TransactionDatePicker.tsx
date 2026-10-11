'use client';

import React, { useState, useEffect, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TransactionDatePickerProps {
    value: string; // ISO metin ya da 'YYYY-MM-DDTHH:mm'
    onChange: (isoString: string) => void;
    onErrorChange?: (hasError: boolean) => void;
}

export default function TransactionDatePicker({ value, onChange, onErrorChange }: TransactionDatePickerProps) {
    const dateId = useId();
    const timeId = useId();

    // Yerel saate göre YYYY-MM-DD
    const getLocalDateStr = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Yerel saate göre HH:mm
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
        } else if (day === 1) { // Pazartesi -> Cuma
            d.setDate(d.getDate() - 3);
        } else {
            d.setDate(d.getDate() - 1);
        }
        return getLocalDateStr(d);
    };
    const lastTradingDayStr = getLastTradingDay();

    // Gelen değeri tarih ve saate ayırır, ileri tarihleri şu ana çeker
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

    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue) {
        setPrevValue(value);
        const parsed = parseValue(value);
        setCurrentDate(parsed.date);
        setCurrentTime(parsed.time);
    }

    // Tarih ve saati birleştirip ISO metin olarak dışarı verir
    const emitChange = (newDate: string, newTime: string) => {
        try {
            // İleri tarih veya saat seçilmişse şu ana çek
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

    // Hızlı seçim düğmesinin görünümü
    const chipClass = (isActive: boolean, isDisabled = false) => cn(
        'h-11 sm:h-10 px-3 rounded border text-sm font-medium whitespace-nowrap transition-colors duration-[120ms]',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        isDisabled
            ? 'opacity-40 cursor-not-allowed border-border bg-surface-2 text-fg-subtle'
            : isActive
                ? 'border-primary bg-primary-soft text-primary cursor-pointer'
                : 'border-border bg-surface-2 text-fg-muted hover:text-fg hover:border-border-strong cursor-pointer',
    );

    const inputClass = 'w-full h-11 sm:h-10 rounded bg-surface-2 border border-border px-3 font-mono text-base text-fg outline-none transition-colors duration-[120ms] hover:border-border-strong focus:border-primary cursor-pointer';

    return (
        <div className="flex flex-col gap-3">
            {/* Tarih */}
            <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={dateId} className="text-13 font-medium text-fg">
                        İşlem tarihi
                    </label>

                    {/* Hızlı tarih düğmeleri */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleDateChange(todayStr)}
                            className={chipClass(currentDate === todayStr)}
                        >
                            Bugün
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDateChange(yesterdayStr)}
                            className={chipClass(currentDate === yesterdayStr)}
                        >
                            Dün
                        </button>
                        {lastTradingDayStr !== yesterdayStr && lastTradingDayStr !== todayStr && (
                            <button
                                type="button"
                                onClick={() => handleDateChange(lastTradingDayStr)}
                                className={chipClass(currentDate === lastTradingDayStr)}
                            >
                                Son seans
                            </button>
                        )}
                    </div>
                </div>

                <input
                    id={dateId}
                    type="date"
                    required
                    max={todayStr}
                    value={currentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={inputClass}
                />
            </div>

            {/* Saat */}
            <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={timeId} className="text-13 font-medium text-fg">
                        İşlem saati
                    </label>

                    {/* Hızlı saat düğmeleri */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleTimeChange(getLocalTimeStr(new Date()))}
                            className={chipClass(false)}
                            title="Şu anki saati seç"
                        >
                            Şimdi
                        </button>
                        <button
                            type="button"
                            disabled={is10FutureToday}
                            onClick={() => handleTimeChange('10:00')}
                            className={chipClass(currentTime === '10:00', is10FutureToday)}
                            title={is10FutureToday ? "Bugün seans açılış saati (10:00) henüz gelmedi" : "Borsa İstanbul açılışı (10:00)"}
                        >
                            10:00 açılış
                        </button>
                        <button
                            type="button"
                            disabled={is18FutureToday}
                            onClick={() => handleTimeChange('18:00')}
                            className={chipClass(currentTime === '18:00', is18FutureToday)}
                            title={is18FutureToday ? "Bugün seans kapanış saati (18:00) henüz gelmedi" : "Borsa İstanbul kapanışı (18:00)"}
                        >
                            18:00 kapanış
                        </button>
                    </div>
                </div>

                <input
                    id={timeId}
                    type="time"
                    required
                    max={isToday ? nowTimeStr : undefined}
                    value={currentTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className={inputClass}
                />
            </div>

            {/* İleri tarih uyarısı */}
            {isFuture && (
                <div role="alert" className="flex items-center gap-2 text-sm font-medium text-loss bg-loss-soft px-3 py-2.5 rounded">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    <span>Gelecekteki bir tarih veya saat seçilemez.</span>
                </div>
            )}
        </div>
    );
}
