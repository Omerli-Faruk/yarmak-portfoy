'use client'

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import {LogOut} from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation";
import { ArrowLeft, Mail, Lock, User } from 'lucide-react';


export default function Navbar() {
    const {user, loading, logOut} = useAuth();
    const pathname = usePathname();
    if (pathname === "/login" || pathname === "/register") {
        return (
            <header className="flex items-center justify-center">
                <Link href="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors z-20"> <ArrowLeft className="w-4 h-4" /> Ana Sayfa </Link>
            </header>
        )
    }

    return (

        <header className="w-full bg-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-between">
                <Link className="flex justify-center items-center" href={user ? "/dashboard" : "/"}>
                    <Image src="/logo.png" alt="Yarmak Logo" width={56} height={56} className="size-14 object-contain" loading="eager"/>
                </Link>
                {user ? (
                    <div
                        className="hidden gap-x-8 md:flex items-center justify-between text-slate-300 text-xs uppercase tracking-widest font-bold">
                        <Link href="/dashboard" className="hover:text-primary transition-colors">Portföyüm</Link>
                        <Link href="/holdings" className="hover:text-primary transition-colors">Varlıklarım</Link>
                        <Link href="/transactions" className="hover:text-primary transition-colors">İşlemler</Link>
                        <Link href="/alerts" className="hover:text-primary transition-colors">Alarmlar</Link>
                    </div>
                ) : (
                    <div
                        className="hidden gap-x-8 md:flex items-center justify-between text-slate-300 text-xs uppercase tracking-widest font-bold">
                        <Link href="#piyasalar" className="hover:text-primary transition-colors">Piyasalar</Link>
                        <Link href="#ozellikler" className="hover:text-primary transition-colors">Özellikler</Link>
                        <Link href="#destek" className="hover:text-primary transition-colors">Destek</Link>
                    </div>
                )}
                {user ? (
                    <div className="gap-x-12 flex items-center justify-between">
                  <span className="text-green-300 hover:text-white px-4 py-2 transition">
                    {user?.username}
                  </span>
                        <button onClick={() => logOut()}
                                className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer flex items-center gap-1.5">
                            <LogOut className="size-4"/> Çıkış Yap
                        </button>
                    </div>
                ) : (
                    <div className="gap-x-12 flex items-center justify-between">
                        <Link href="/login" className="text-slate-300 hover:text-white px-4 py-2 transition">
                            Giriş Yap
                        </Link>
                        <Link href="/register"
                              className="bg-primary hover:bg-primary-hover text-slate-950 font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-primary/20">
                            Ücretsiz hesap oluştur
                        </Link>
                    </div>
                )}
            </div>
        </header>

    );
}