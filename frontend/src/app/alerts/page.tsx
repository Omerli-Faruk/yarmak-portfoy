'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { Bell, Plus, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { normalizeAlert } from '@/lib/normalize';
import type { NormalizedAlert, RawPriceAlert } from '@/types';
import AlertStatsCards from '@/components/alerts/AlertStatsCards';
import AlertFilterBar, { type AlertFilter } from '@/components/alerts/AlertFilterBar';
import AlertCard, { AlertTableHeader } from '@/components/alerts/AlertCard';
import CreateAlertModal from '@/components/alerts/CreateAlertModal';
import DeleteAlertModal from '@/components/alerts/DeleteAlertModal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';

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
        <PageContainer>
            <PageHeader
                title="Fiyat alarmları"
                subtitle="Hedefe ulaşan alarmlar bildirim çanında da görünür. Hisse fiyatları en az 15 dakika gecikmelidir."
                actions={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchAlerts(true)}
                            disabled={refreshing}
                            title="Yenile"
                            aria-label="Yenile"
                            leftIcon={<RefreshCw className={refreshing ? 'animate-spin' : undefined} />}
                        >
                            <span className="hidden sm:inline">Yenile</span>
                        </Button>
                        <Button size="sm" onClick={openCreateModal} leftIcon={<Plus />}>
                            Yeni alarm kur
                        </Button>
                    </>
                }
            />

            {/* Odak: bekleyen alarm sayısı, altında tetiklenen ve toplam */}
            <AlertStatsCards
                loading={loading}
                totalCount={totalCount}
                pendingCount={pendingCount}
                triggeredCount={triggeredCount}
            />

            {/* Kutusuz liste: sekmeler + arama tek satırda, tablo doğrudan sayfa zemininde */}
            <section aria-label="Alarm listesi" className="flex flex-col min-w-0">
                <AlertFilterBar
                    filterTab={filterTab}
                    onFilterTab={setFilterTab}
                    searchQuery={searchQuery}
                    onSearch={setSearchQuery}
                />

                {loading ? (
                    <div aria-busy className="flex flex-col divide-y divide-border">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="flex items-center gap-4 h-12">
                                <Skeleton className="h-3.5 w-16" />
                                <Skeleton className="h-3.5 w-32 max-w-full" />
                                <Skeleton className="ml-auto h-3.5 w-20" />
                                <Skeleton className="hidden h-3.5 w-20 lg:block" />
                                <Skeleton className="hidden h-3.5 w-24 lg:block" />
                            </div>
                        ))}
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <EmptyState
                        className="py-12"
                        icon={<Bell />}
                        title={searchQuery ? 'Aramanıza uygun alarm bulunamadı' : 'Henüz bir fiyat alarmı kurmadınız'}
                        description={
                            searchQuery
                                ? `"${searchQuery}" kriterine uyan bir alarm yok. Aramayı sıfırlayabilirsiniz.`
                                : 'İlk alarmınızı kurun; hedef fiyata ulaşıldığında burada göreceksiniz.'
                        }
                    />
                ) : (
                    <>
                        <AlertTableHeader />
                        <ul className="flex flex-col divide-y divide-border border-b border-border">
                            <AnimatePresence>
                                {filteredAlerts.map((alert) => (
                                    <AlertCard key={alert.id} alert={alert} onDelete={setDeleteModalId} />
                                ))}
                            </AnimatePresence>
                        </ul>
                    </>
                )}
            </section>

            {/* Modal her açılışta yeniden kurulur; böylece form durumu sıfırlanır */}
            {isModalOpen && (
                <CreateAlertModal
                    key={prefillSymbol ?? 'new'}
                    initialSymbol={prefillSymbol ?? undefined}
                    onClose={closeCreateModal}
                    onCreated={handleAlertCreated}
                />
            )}

            {deleteModalId !== null && (
                <DeleteAlertModal
                    isDeleting={isDeleting}
                    onCancel={() => setDeleteModalId(null)}
                    onConfirm={() => {
                        if (deleteModalId) void handleDeleteAlert(deleteModalId);
                    }}
                />
            )}
        </PageContainer>
    );
}

export default function AlertsPage() {
    return (
        <Suspense fallback={<LoadingSpinner fullScreen={false} message="Yükleniyor..." />}>
            <AlertsContent />
        </Suspense>
    );
}
