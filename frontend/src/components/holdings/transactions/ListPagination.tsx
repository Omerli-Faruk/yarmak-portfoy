'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ListPaginationProps {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    // "işlemden", "kayıttan" gibi: "Toplam 40 işlemden 1 - 25 arası gösteriliyor"
    unitLabel: string;
    onPageChange: (page: number) => void;
}

// İşlem ve temettü listelerinin altındaki sayfa geçişi. Tabloyu son satırın çizgisi kapattığı için kendi çizgisi yok.
export default function ListPagination({
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    unitLabel,
    onPageChange,
}: ListPaginationProps) {
    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalCount);

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-11 pt-2">
            <p className="text-sm text-fg-muted">
                Toplam <span className="font-mono text-fg">{totalCount}</span> {unitLabel}{' '}
                <span className="font-mono text-fg">{from}</span> -{' '}
                <span className="font-mono text-fg">{to}</span> arası gösteriliyor
            </p>

            {/* Hayalet düğmelerin iç boşluğu sağ kenarı içeri çekmesin diye */}
            <div className="flex items-center gap-1 ml-auto -mr-2">
                <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ChevronLeft />}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    Önceki
                </Button>
                <span className="min-w-14 text-center font-mono text-sm text-fg">
                    {currentPage} / {totalPages}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    rightIcon={<ChevronRight />}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                >
                    Sonraki
                </Button>
            </div>
        </div>
    );
}
