'use client'

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export default function Navbar() {
    const {user, loading, logOut} = useAuth();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
        return (
            <header className="flex items-center justify-center">
                <Link href="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors z-20"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>
            </header>
        )
    }

    return (
        <header className="w-full ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                {/* LOGO */}
                <Link className="flex justify-center items-center" href="/">
                    <Image src="/logo.png" alt="Yarmak Logo" width={48} height={48} className="size-12 object-contain" loading="eager"/>
                </Link>

                {/* DESKTOP MENU */}
                <div className="hidden md:flex items-center gap-x-8 text-slate-300 text-xs uppercase tracking-widest font-bold">
                    {user ? (
                        <>
                            <Link href="/dashboard" className="hover:text-primary transition-colors">Portföyüm</Link>
                            <Link href="/holdings" className="hover:text-primary transition-colors">Varlıklarım</Link>
                            <Link href="/transactions" className="hover:text-primary transition-colors">İşlemler</Link>
                            <Link href="/alerts" className="hover:text-primary transition-colors">Alarmlar</Link>
                        </>
                    ) : (
                        <>
                            <Link href="/#piyasalar" className="hover:text-primary transition-colors">Piyasalar</Link>
                            <Link href="/#ozellikler" className="hover:text-primary transition-colors">Özellikler</Link>
                            <Link href="/#destek" className="hover:text-primary transition-colors">Destek</Link>
                        </>
                    )}
                </div>

                {/* DESKTOP RIGHT (USER ACTIONS) */}
                <div className="hidden md:flex items-center gap-x-6">
                    {user ? (
                        <>
                            <Link href="/profile" className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition hover:underline">
                                {user?.username}
                            </Link>
                            <button onClick={() => logOut()}
                                    className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer flex items-center gap-1.5 font-medium bg-slate-800/50 px-3 py-2 rounded-lg">
                                <LogOut className="size-4"/> Çıkış Yap
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition">
                                Giriş Yap
                            </Link>
                            <Link href="/register"
                                  className="bg-primary hover:bg-primary-hover text-slate-950 font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-primary/20 text-sm">
                                Ücretsiz Hesap Oluştur
                            </Link>
                        </>
                    )}
                </div>

                {/* MOBILE MENU TOGGLE */}
                <button 
                    className="md:hidden text-slate-300 hover:text-white p-2"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                </button>
            </div>

            {/* MOBILE MENU OVERLAY */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-20 left-0 w-full bg-ambient-spotlight border-b border-white/5 shadow-2xl flex flex-col p-4 md:hidden gap-4"
                    >
                        {user ? (
                            <div className="flex flex-col gap-4 text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                                <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Portföyüm</Link>
                                <Link href="/holdings" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Varlıklarım</Link>
                                <Link href="/transactions" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">İşlemler</Link>
                                <Link href="/alerts" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Alarmlar</Link>
                                <div className="h-px bg-white/10 my-2"></div>
                                <div className="flex items-center justify-between px-2">
                                    <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="text-emerald-400 hover:text-emerald-300 font-medium normal-case">
                                        {user?.username}
                                    </Link>
                                    <button onClick={() => { logOut(); setIsMobileMenuOpen(false); }}
                                            className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1.5 normal-case">
                                        <LogOut className="size-4"/> Çıkış
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                                <Link href="/#piyasalar" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Piyasalar</Link>
                                <Link href="/#ozellikler" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Özellikler</Link>
                                <Link href="/#destek" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary p-2 bg-white/5 rounded-lg">Destek</Link>
                                <div className="h-px bg-white/10 my-2"></div>
                                <div className="flex flex-col gap-3">
                                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-center font-semibold text-white bg-slate-800 p-3 rounded-xl">
                                        Giriş Yap
                                    </Link>
                                    <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}
                                          className="text-center bg-primary text-slate-950 font-bold p-3 rounded-xl shadow-lg shadow-primary/20">
                                        Ücretsiz Hesap Oluştur
                                    </Link>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}