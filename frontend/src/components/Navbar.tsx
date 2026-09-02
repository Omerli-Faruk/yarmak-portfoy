'use client'

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import {LogOut} from "lucide-react"
import Image from "next/image"

export default function Navbar() {
    const { user, loading, logOut } = useAuth();


    return (

        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex items-center justify-between">
                <Link className="flex justify-center items-center" href="/">
                    <Image src="/logo.png" alt="Yarmak Logo" width={56} height={56} className="size-14 object-contain"/>
                </Link>
                {user ? (
                    <div
                        className="hidden gap-x-8 md:flex items-center justify-between text-slate-400 text-xs uppercase tracking-widest">
                        <Link href="/"   className="hover:text-primary transition-colors">Portföyüm</Link>
                        <Link href="/holdings" className="hover:text-primary transition-colors">Varlıklarım</Link>
                        <Link href="/transactions" className="hover:text-primary transition-colors">İşlemler</Link>
                        <Link href="/alerts" className="hover:text-primary transition-colors">Alarmlar</Link>
                    </div>
                ) : (
                    <div
                        className="hidden gap-x-8 md:flex items-center justify-between text-slate-400 text-xs uppercase tracking-widest">
                        <Link href="#piyasalar" className="hover:text-primary transition-colors">Piyasalar</Link>
                        <Link href="#ozellikler" className="hover:text-primary transition-colors">Özellikler</Link>
                        <Link href="#destek" className="hover:text-primary transition-colors">Destek</Link>
                    </div>
                )}
                {user ? (
                    <div className="gap-x-12 flex items-center justify-between">
                        <span className="text-green-300 hover:text-white px-4 py-2 transition">
                            {user?.email}
                        </span>
                        <button onClick={() => logOut()} className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer flex items-center gap-1.5">
                            <LogOut className="size-4" /> Çıkış Yap
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