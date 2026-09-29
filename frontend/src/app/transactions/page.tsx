'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TransactionsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/markets');
    }, [router]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
            <div className="flex flex-col items-center gap-3">
                <span className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">İşlem geçmişine yönlendiriliyorsunuz...</span>
            </div>
        </div>
    );
}
