'use client'

import React, {useState} from "react";
import {useAuth} from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";

export default function LoginPage() {
    const {login} = useAuth();
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('')
        setLoading(true)
        try {
            await login(email, password);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
            } else {
                setError("Beklenmeyen bir hata oluştu.");
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <div
                className="w-full max-w-md border border-border bg-surface rounded-3xl p-8 sm:p-12 shadow-2xl flex items-center justify-center flex-col">
                <Link href="/">
                    <Image src="/logo.png" alt="Yarmak Logo" width={64} height={64}
                           className="size-16 object-contain mb-2"/>
                </Link>
                <span className="tracking-widest font-black text-2xl">Yarmak Portföy</span>
                <p className="text-slate-400 text-xs tracking-widest">Finansal kontrol paneline erişmek için giriş
                    yapın.</p>
                <form onSubmit={handleSubmit} className="w-full space-y-4 mt-6">
                    {error && <div
                        className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl text-center">{error}</div>}
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-posta</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                           placeholder="ornek@email.com" required
                           className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition"/>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-300">Şifre</label>
                        <button
                            type="button"
                            onClick={() => alert("Lütfen sistem yöneticisi ile iletişime geçin.")}
                            className="text-xs text-slate-400 hover:text-primary transition cursor-pointer"
                        >
                            Şifremi Unuttum?
                        </button>
                    </div>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                           placeholder="••••••••" required
                           className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary transition"/>
                    <button type="submit" disabled={loading}
                            className="w-full bg-primary hover:bg-primary-hover text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 mt-6">{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</button>
                    <p className="text-center text-xs text-slate-400 mt-6">
                        Hesabınız yok mu? <Link href="/register"
                                                className="text-accent hover:underline font-medium ml-1">Hemen Kayıt
                        Ol</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}