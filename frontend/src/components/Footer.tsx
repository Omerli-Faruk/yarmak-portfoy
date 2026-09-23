'use client';

import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";


export default function Footer() {
    const { user } = useAuth();

    return (
        <footer className="w-full border-t border-slate-800 bg-[#0A0E14] pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Image src="/logo.png" alt="Yarmak Logo" width={24} height={24} className="size-6 object-contain" loading="eager"/>
                            <span className="font-bold text-white tracking-widest text-xl">
                                YARMAK
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mt-2">
                            Tarihin ilk parasından geleceğin akıllı portföyüne. BIST ve TEFAS yatırımlarınızı tek bir ekranda, canlı ve ücretsiz takip edin.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="text-white font-semibold mb-6">Platform</h4>
                        <ul className="flex flex-col gap-3 text-sm text-slate-400">
                            <li><Link href="/#piyasalar" className="hover:text-primary transition-colors">Piyasalar</Link></li>
                            <li><Link href="/#ozellikler" className="hover:text-primary transition-colors">Özellikler</Link></li>
                            {user ? (
                                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Portföyüm</Link></li>
                            ) : (
                                <li><Link href="/register" className="hover:text-primary transition-colors">Hesap Oluştur</Link></li>
                            )}
                        </ul>
                    </div>

                    {/* Kaynaklar */}
                    <div>
                        <h4 className="text-white font-semibold mb-6">Kaynaklar</h4>
                        <ul className="flex flex-col gap-3 text-sm text-slate-400">
                            <li><a href="#" className="hover:text-primary transition-colors">Kullanım Rehberi</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Sıkça Sorulan Sorular</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Gizlilik Politikası</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Kullanım Şartları</a></li>
                        </ul>
                    </div>

                    {/* İletişim */}
                    <div>
                        <h4 className="text-white font-semibold mb-6">İletişim</h4>
                        <ul className="flex flex-col gap-3 text-sm text-slate-400">
                            <li className="flex items-center gap-3">
                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                <a href="mailto:destek@yarmak.com" className="hover:text-white transition-colors">destek@yarmak.com</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>© 2026 Yarmak Portföy. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </footer>
    )
}
