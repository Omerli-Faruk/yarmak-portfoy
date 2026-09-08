'use client';

import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";


export default function Footer() {
    const { user } = useAuth();

    return (
        <footer className="w-full border-t border-border bg-[#0A0E14] py-12 flex items-center justify-center">
            <div
                className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
                <div className="flex flex-col items-center md:items-start gap-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className="size-5 bg-primary rounded flex items-center justify-center text-black font-bold text-[10px]">
                            Y
                        </div>
                        <span className="font-bold text-slate-200 tracking-wider text-sm">
                                YARMAK
                            </span>
                    </div>
                    <span>Tarihin ilk parasından geleceğin akıllı portföyüne.</span>
                </div>
                <div className="flex items-center gap-8">
                    {user ? (
                        <Link href="/dashboard" className="hover:text-primary transition font-medium">
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className="hover:text-primary transition font-medium">
                                Giriş Yap
                            </Link>
                            <Link href="/register" className="hover:text-primary transition font-medium">
                                Ücretsiz Kayıt Ol
                            </Link>
                        </>
                    )}
                    <span className="text-slate-600 hidden sm:inline">
                        © 2026 Yarmak FinTech
                    </span>
                </div>
            </div>
        </footer>
    )
}
