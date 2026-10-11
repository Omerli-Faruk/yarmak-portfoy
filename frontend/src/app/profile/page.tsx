'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import SummaryStrip from '@/components/ui/SummaryStrip';
import Button from '@/components/ui/Button';
import { LogOut } from 'lucide-react';

export default function ProfilePage() {
    const { user, loading, logOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <LoadingSpinner withLogo message="Profil yükleniyor..." />;
    }

    const memberDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Belirtilmemiş';

    return (
        <PageContainer width="narrow">
            {/* Kullanıcı adı sayfanın odak noktası; hesap bilgileri altındaki tek şeritte.
                Sayfa bağlantıları üst menüde ve alt sekme çubuğunda olduğu için burada tekrar edilmez. */}
            <div className="flex flex-col gap-6">
                <PageHeader
                    title={<span className="block truncate">{user.username}</span>}
                    actions={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => logOut()}
                            leftIcon={<LogOut />}
                            className="hover:bg-loss-soft hover:text-loss"
                        >
                            Çıkış yap
                        </Button>
                    }
                />
                <SummaryStrip
                    ariaLabel="Hesap"
                    items={[
                        // E-posta ve hesap tipi metin olduğu için arayüz yazısıyla, tarih mono yazılır
                        { label: 'E-posta', value: <span className="font-sans">{user.email}</span>, title: user.email },
                        { label: 'Kayıt tarihi', value: memberDate },
                        {
                            label: 'Hesap tipi',
                            value: <span className="font-sans">{user.role === 'ADMIN' ? 'Yönetici' : 'Standart üye'}</span>,
                        },
                    ]}
                />
            </div>
        </PageContainer>
    );
}
