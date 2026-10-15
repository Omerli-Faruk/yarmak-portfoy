'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function TransactionsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/varliklar?sekme=islemler');
    }, [router]);

    return (
        <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-4">
            <LoadingSpinner fullScreen={false} message="İşlem geçmişine yönlendiriliyorsunuz..." />
        </div>
    );
}
