'use client'

import React, {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {useRouter} from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import {User, Lock, Eye, EyeOff} from "lucide-react";
import {motion} from "motion/react";

export default function LoginPage() {
    const {user, loading: authLoading, login} = useAuth();
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!authLoading && user) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('')
        setLoading(true)
        try {
            await login(identifier, password);
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
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.35, ease: "easeOut"}}
                className="w-full max-w-md border border-border bg-surface rounded-3xl p-8 sm:p-12 shadow-2xl flex items-center justify-center flex-col"
            >
                <Link href="/">
                    <Image src="/logo.png" alt="Yarmak Logo" width={64} height={64}
                           className="size-16 object-contain mb-2"/>
                </Link>
                <div className="flex flex-col items-center justify-center text-center">

                    <span className="tracking-widest font-black text-2xl">Yarmak Portföy</span>
                    <p className="text-slate-400 text-xs tracking-widest mt-1">Finansal kontrol paneline erişmek için giriş
                        yapın.</p>
                </div>
                <form onSubmit={handleSubmit} className="w-full space-y-4 mt-10">
                    {error && <div
                        className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl text-center">{error}</div>}
                    <label className="text-xs text-slate-400 hover:text-primary">E-posta veya Kullanıcı Adı</label>
                    <div
                        className="flex items-center gap-4 bg-black/30 border border-border rounded-xl px-4 py-3 focus-within:border-primary transition mt-1">
                        <User className="size-4 text-slate-500 shrink-0"/>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="ornek@email.com"
                            required
                            className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-slate-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-between items-center mb-1 mt-6">
                        <label className="text-xs text-slate-400 hover:text-primary">Şifre</label>
                        <button
                            type="button"
                            onClick={() => alert("Lütfen sistem yöneticisi ile iletişime geçin.")}
                            className="text-xs font-bold text-primary hover:text-white transition cursor-pointer"
                        >
                            Şifremi Unuttum?
                        </button>
                    </div>
                    <div
                        className="flex items-center gap-4 bg-black/30 border border-border rounded-xl px-4 py-3 focus-within:border-primary transition mt-1">
                        <Lock className="size-4 text-slate-500 shrink-0"/>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-slate-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-500 hover:text-slate-300 transition cursor-pointer shrink-0"
                        >
                            {showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                        </button>
                    </div>
                    <button type="submit" disabled={loading}
                            className="w-full bg-primary hover:bg-primary-hover text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 mt-6">{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</button>
                    <p className="text-center text-xs text-slate-400 mt-6">Hesabınız yok mu?
                        <Link href="/register" className="text-xs font-bold text-white hover:text-primary transition cursor-pointer ml-2">Hemen Kayıt Ol</Link>
                    </p>
                </form>
            </motion.div>
        </div>
    );
}