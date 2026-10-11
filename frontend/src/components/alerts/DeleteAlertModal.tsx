'use client';

import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface DeleteAlertModalProps {
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

// Sayfa bu bileşeni yalnızca silinecek alarm seçiliyken çizer; bu yüzden pencere hep açık gelir
export default function DeleteAlertModal({ isDeleting, onCancel, onConfirm }: DeleteAlertModalProps) {
    return (
        <Modal
            open
            onClose={onCancel}
            dismissible={!isDeleting}
            size="sm"
            icon={<Trash2 />}
            iconTone="loss"
            title="Fiyat alarmını sil"
            description="Bu alarmı kaldırmak istediğinizden emin misiniz? Bu işlem geri alınamaz."
            footer={
                <>
                    <Button variant="secondary" size="sm" onClick={onCancel} disabled={isDeleting}>
                        İptal
                    </Button>
                    <Button variant="danger" size="sm" onClick={onConfirm} loading={isDeleting}>
                        {isDeleting ? 'Siliniyor...' : 'Evet, sil'}
                    </Button>
                </>
            }
        />
    );
}
