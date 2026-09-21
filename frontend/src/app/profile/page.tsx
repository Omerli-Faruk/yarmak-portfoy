'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { User, Mail, Shield, Calendar, ArrowRight, Briefcase, Layers, LogOut } from 'lucide-react';

export default function ProfilePage() {
    const { user, loading, logOut } = useAuth();
    const router = useRouter();

    if (loading) {
        return <LoadingSpinner withLogo message="Profil yükleniyor..." />;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    const memberDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Belirtilmemiş';

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Profil Başlığı */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-indigo-600/30 shrink-0">
                            {user.username?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="text-center sm:text-left space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-white">{user.username}</h1>
                                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Aktif Yatırımcı
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                                <Mail className="w-4 h-4 text-slate-500" />
                                {user.email}
                            </p>
                        </div>

                        <button
                            onClick={() => logOut()}
                            className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                            Çıkış Yap
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-800/80">
                        <div className="flex items-center gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                            <Calendar className="w-5 h-5 text-indigo-400" />
                            <div>
                                <p className="text-xs text-slate-400">Kayıt Tarihi</p>
                                <p className="text-sm font-semibold text-white">{memberDate}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            <div>
                                <p className="text-xs text-slate-400">Hesap Tipi</p>
                                <p className="text-sm font-semibold text-white capitalize">{user.role || 'Standart Üye'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hızlı Erişim Kartları */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                        href="/dashboard"
                        className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl transition group flex flex-col justify-between space-y-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Briefcase className="w-6 h-6" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition">Portföy Genel Bakış</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Portföyünüzün büyüme grafiğini, kategori dağılımını ve net getirisini inceleyin.
                            </p>
                        </div>
                    </Link>

                    <Link
                        href="/holdings"
                        className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-2xl transition group flex flex-col justify-between space-y-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Layers className="w-6 h-6" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">Varlıklarım & Gruplar</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Hisselerinizi özel gruplara ayırın, 1D/1W getirilerini görün ve sıralayın.
                            </p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
