'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Mail, Shield, Calendar, ArrowRight, Briefcase, Layers, LogOut } from 'lucide-react';

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
        <div className="min-h-screen text-slate-100 py-8 px-3 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
                {/* Profil Başlığı */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-2xl font-bold text-slate-200 shrink-0">
                            {user.username?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="text-center sm:text-left space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-white">{user.username}</h1>
                            </div>
                            <p className="text-sm text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                                <Mail className="w-4 h-4 text-slate-500" />
                                {user.email}
                            </p>
                        </div>

                        <button
                            onClick={() => logOut()}
                            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                            Çıkış Yap
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-800/80">
                        <div className="flex items-center gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-400">Kayıt Tarihi</p>
                                <p className="text-sm font-semibold text-white">{memberDate}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                            <Shield className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-400">Hesap Tipi</p>
                                <p className="text-sm font-semibold text-white">{user.role === 'ADMIN' ? 'Yönetici' : 'Standart Üye'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hızlı Erişim Kartları */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                        href="/dashboard"
                        className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl transition group flex flex-col justify-between space-y-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white transition">
                                <Briefcase className="w-5 h-5 text-slate-400" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white group-hover:text-slate-200 transition">Portföy özeti</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Portföyünüzün değer grafiğini, kategori dağılımını ve net getirisini inceleyin.
                            </p>
                        </div>
                    </Link>

                    <Link
                        href="/holdings"
                        className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl transition group flex flex-col justify-between space-y-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-white transition">
                                <Layers className="w-5 h-5 text-slate-400" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white group-hover:text-slate-200 transition">Varlıklarım ve gruplar</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Varlıklarınızı özel gruplara ayırın, günlük ve haftalık (1G/1H) getirilerini görün ve sıralayın.
                            </p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
