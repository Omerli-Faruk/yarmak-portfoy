'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { UserHolding } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import AssetAvatar from '@/components/ui/AssetAvatar';

interface DeleteAssetModalProps {
    isOpen: boolean;
    asset: UserHolding | null;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
    fmt: (val: number) => string;
}

export default function DeleteAssetModal({
    isOpen,
    asset,
    isSubmitting,
    onClose,
    onConfirm,
    fmt,
}: DeleteAssetModalProps) {
    if (!asset) return null;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!isSubmitting}
            title="Varlığı sil"
            description="Bu işlem geri alınamaz"
            icon={<AlertTriangle />}
            iconTone="loss"
            footer={
                <>
                    <Button variant="ghost" size="sm" disabled={isSubmitting} onClick={onClose}>
                        Vazgeç
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        loading={isSubmitting}
                        leftIcon={<Trash2 />}
                        onClick={onConfirm}
                    >
                        {isSubmitting ? 'Siliniyor...' : 'Evet, sil'}
                    </Button>
                </>
            }
        >
            <div className="flex items-center gap-3 py-3 border-y border-border">
                <AssetAvatar symbol={asset.symbol} size="md" />
                <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-base text-fg truncate">
                        <span className="font-mono font-semibold">{asset.symbol}</span> <span className="text-fg-muted">{asset.asset_name}</span>
                    </p>
                    <p className="text-sm text-fg-muted">
                        Adet: <span className="font-mono text-fg">{asset.total_amount.toLocaleString('tr-TR')}</span>
                        {' · '}
                        Değer: <span className="font-mono text-fg">{fmt(asset.total_value)}</span>
                    </p>
                </div>
            </div>

            <p className="text-sm text-fg leading-relaxed">
                Bu varlığa ait sistemde kayıtlı <strong className="font-medium text-fg">tüm alım-satım işlemleri</strong> silinecek ve varlık portföyünüzden kaldırılacaktır.
            </p>
        </Modal>
    );
}
