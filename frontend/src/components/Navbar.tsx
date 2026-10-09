'use client'

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import NotificationBell from '@/components/NotificationBell';

// Giriş yapmış kullanıcının menüsü
const USER_LINKS = [
    { href: '/dashboard', label: 'Portföyüm' },
    { href: '/holdings', label: 'Varlıklarım' },
    { href: '/markets', label: 'Piyasalar' },
    { href: '/alerts', label: 'Alarmlar' },
];

// Ziyaretçi menüsü; # ile başlayanlar ana sayfadaki bölümlere gider
const GUEST_LINKS = [
    { href: '/markets', label: 'Piyasalar' },
    { href: '/#ozellikler', label: 'Özellikler' },
    { href: '/#destek', label: 'Destek' },
];

export default function Navbar() {
    const {user, logOut} = useAuth();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
        return (
            <header className="flex items-center justify-center">
                <Link href="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors z-20"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>
            </header>
        )
    }

    const navLinks = user ? USER_LINKS : GUEST_LINKS;
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <header className="w-full relative z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
                <Link className="flex justify-center items-center" href={user ? "/dashboard" : "/"}>
                    <Image src="/logo.png" alt="Yarmak Logo" width={48} height={48} className="size-12 object-contain" loading="eager"/>
                </Link>

                {/* Masaüstü menü */}
                <div className="hidden md:flex items-center gap-x-8 text-xs uppercase tracking-widest font-bold">
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${pathname === link.href ? 'text-primary font-black' : 'text-slate-300 hover:text-primary'} transition-colors`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Sağ taraf. Bildirim çanı her genişlikte tek kez render edilir:
                    masaüstünde [çan][kullanıcı adı][çıkış], mobilde [çan][menü düğmesi]. */}
                <div className="flex items-center justify-end gap-2 md:gap-x-6 md:min-w-[200px]">
                    {user && <NotificationBell />}

                    <div className="hidden md:flex items-center gap-x-6">
                        {user ? (
                            <>
                                <Link href="/profile" className="text-[#1A9FD3] hover:text-[#0C6991] font-semibold text-sm transition hover:underline">
                                    {user.username}
                                </Link>
                                <button onClick={() => logOut()}
                                        className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer flex items-center gap-1.5 font-medium bg-slate-800/50 px-3 py-2 rounded-lg">
                                    <LogOut className="size-4"/> Çıkış Yap
                                </button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-[#1A9FD3] transition">
                                    Giriş Yap
                                </Link>
                                <Link href="/register"
                                      className="bg-primary hover:bg-primary-hover text-white font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-primary/20 text-sm">
                                    Ücretsiz Hesap Oluştur
                                </Link>
                            </>
                        )}
                    </div>

                    <button
                        className="md:hidden text-slate-300 hover:text-white p-2 rounded-xl cursor-pointer"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Menüyü Aç/Kapat"
                    >
                        {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                    </button>
                </div>
            </div>

            {/* Mobil menü */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-20 left-0 w-full bg-[#0A0E14]/95 backdrop-blur-xl border-b border-slate-800 shadow-2xl flex flex-col p-4 md:hidden gap-4 z-50"
                    >
                        <div className="flex flex-col gap-4 text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">
                            {navLinks.map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={closeMobileMenu}
                                    className={`p-2 rounded-lg ${pathname === link.href ? 'text-primary bg-primary/10' : 'hover:text-primary bg-white/5'}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="h-px bg-white/10 my-2"></div>
                            {user ? (
                                <div className="flex items-center justify-between px-2">
                                    <Link href="/profile" onClick={closeMobileMenu} className="text-[#1A9FD3] hover:text-[#0C6991] font-semibold normal-case">
                                        {user.username}
                                    </Link>
                                    <button onClick={() => { logOut(); closeMobileMenu(); }}
                                            className="text-rose-400 hover:text-rose-300 transition flex items-center gap-1.5 normal-case">
                                        <LogOut className="size-4"/> Çıkış
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <Link href="/login" onClick={closeMobileMenu} className="text-center font-semibold text-slate-300 hover:text-[#1A9FD3] bg-slate-800 p-3 rounded-xl transition">
                                        Giriş Yap
                                    </Link>
                                    <Link href="/register" onClick={closeMobileMenu}
                                          className="text-center bg-primary hover:bg-primary-hover text-white font-bold p-3 rounded-xl shadow-lg shadow-primary/20 transition">
                                        Ücretsiz Hesap Oluştur
                                    </Link>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
