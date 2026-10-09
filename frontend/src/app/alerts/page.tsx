'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { Bell, BellRing, Plus, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { normalizeAlert } from '@/lib/normalize';
import type { NormalizedAlert, RawPriceAlert } from '@/types';
import AlertStatsCards from '@/components/alerts/AlertStatsCards';
import AlertFilterBar, { type AlertFilter } from '@/components/alerts/AlertFilterBar';
import AlertCard from '@/components/alerts/AlertCard';
import CreateAlertModal from '@/components/alerts/CreateAlertModal';
import DeleteAlertModal from '@/components/alerts/DeleteAlertModal';

function AlertsContent() {
    const searchParams = useSearchParams();
    const querySymbol = searchParams.get('symbol');

    const [alerts, setAlerts] = useState<NormalizedAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterTab, setFilterTab] = useState<AlertFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal her açılışta yeniden kurulur. prefillSymbol yalnızca ?symbol= ile açılınca dolu olur.
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefillSymbol, setPrefillSymbol] = useState<string | null>(null);

    const fetchAlerts = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const res = await api.get<RawPriceAlert[]>('/alerts');
            const data = Array.isArray(res.data) ? res.data : [];
            setAlerts(data.map(normalizeAlert));
        } catch (err) {
            console.error('Alarmlar yüklenirken hata:', err);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchAlerts();
    }, []);

    // Varlık sayfasından /alerts?symbol=THYAO ile gelindiyse modal o sembolle açılır
    useEffect(() => {
        if (querySymbol) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPrefillSymbol(querySymbol.toUpperCase());
            setIsModalOpen(true);
        }
    }, [querySymbol]);

    const openCreateModal = () => {
        setPrefillSymbol(null);
        setIsModalOpen(true);
    };

    const closeCreateModal = () => {
        setIsModalOpen(false);
        setPrefillSymbol(null);
    };

    const handleAlertCreated = () => {
        closeCreateModal();
        void fetchAlerts(true);
    };

    const handleDeleteAlert = async (id: number) => {
        setIsDeleting(true);
        try {
            await api.delete(`/alerts/${id}`);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
            setDeleteModalId(null);
        } catch (err) {
            console.error('Alarm silinirken hata:', err);
            alert('Alarm silinirken bir hata oluştu.');
        } finally {
            setIsDeleting(false);
        }
    };

    const totalCount = alerts.length;
    const pendingCount = alerts.filter((a) => !a.isTriggered).length;
    const triggeredCount = alerts.filter((a) => a.isTriggered).length;

    const filteredAlerts = useMemo(() => {
        return alerts.filter((a) => {
            const matchesTab =
                filterTab === 'ALL' ? true : filterTab === 'PENDING' ? !a.isTriggered : a.isTriggered;
            const matchesSearch =
                searchQuery.trim() === '' ||
                a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.assetName.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [alerts, filterTab, searchQuery]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300">
                            <BellRing className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                Fiyat Alarmları
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                                Belirlediğiniz hedef fiyata ulaşıldığında alarm burada ve bildirim çanında görünür.
                                Hisse fiyatları en az 15 dakika gecikmeli gelir.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAlerts(true)}
                        disabled={refreshing}
                        className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        title="Yenile"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-400' : ''}`} />
                        <span className="hidden sm:inline">Yenile</span>
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Yeni Alarm Kur</span>
                    </button>
                </div>
            </div>

            <AlertStatsCards totalCount={totalCount} pendingCount={pendingCount} triggeredCount={triggeredCount} />

            <AlertFilterBar
                filterTab={filterTab}
                onFilterTab={setFilterTab}
                counts={{ ALL: totalCount, PENDING: pendingCount, TRIGGERED: triggeredCount }}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
            />

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-44 rounded-2xl bg-surface/40 border border-white/5 animate-pulse" />
                    ))}
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="bg-surface/30 border border-dashed border-white/10 rounded-3xl p-12 text-center max-w-xl mx-auto my-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-4">
                        <Bell className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                        {searchQuery ? 'Aramanıza uygun alarm bulunamadı' : 'Henüz bir fiyat alarmı kurmadınız'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                        {searchQuery
                            ? `"${searchQuery}" kriterine uyan bir alarm yok. Aramayı sıfırlayabilirsiniz.`
                            : 'İlk alarmınızı kurun; hedef fiyata ulaşıldığında burada göreceksiniz.'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={openCreateModal}
                            className="mt-6 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs transition inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" />
                            İlk Alarmı Oluştur
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                        {filteredAlerts.map((alert) => (
                            <AlertCard key={alert.id} alert={alert} onDelete={setDeleteModalId} />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <CreateAlertModal
                        key={prefillSymbol ?? 'new'}
                        initialSymbol={prefillSymbol ?? undefined}
                        onClose={closeCreateModal}
                        onCreated={handleAlertCreated}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteModalId !== null && (
                    <DeleteAlertModal
                        isDeleting={isDeleting}
                        onCancel={() => setDeleteModalId(null)}
                        onConfirm={() => {
                            if (deleteModalId) void handleDeleteAlert(deleteModalId);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default function AlertsPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Yükleniyor...</span>
                </div>
            }
        >
            <AlertsContent />
        </Suspense>
    );
}
