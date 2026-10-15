'use client'

import React, {useState} from "react";
import {useAuth} from "@/context/AuthContext";
import Link from "next/link";
import axios from "axios";
import {Eye, EyeOff, AlertCircle, ArrowRight} from "lucide-react";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthShell, {authLinkClass, authSwitchLinkClass, authToggleClass} from "./AuthShell";

export default function LoginPage() {
    const {user, login} = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)


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
        <AuthShell
            title="Giriş yap"
            footer={
                <>
                    <span>Hesabınız yok mu?</span>
                    <Link href="/kayit" className={authSwitchLinkClass}>
                        Kayıt ol
                    </Link>
                </>
            }
        >
            {user && (
                <p className="border-b border-border pb-3 text-sm text-fg">
                    Şu anda <span className="font-medium">{user.username}</span> hesabıyla oturumunuz açık.{' '}
                    <Link
                        href="/portfoy"
                        className="inline-flex min-h-11 items-center gap-1 rounded font-medium text-primary hover:text-primary-hover sm:min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Portföyüme git <ArrowRight className="size-4" aria-hidden/>
                    </Link>
                </p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                    <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2.5 text-sm text-loss">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/>
                        <span>{error}</span>
                    </div>
                )}

                <Field label="E-posta veya kullanıcı adı" htmlFor="login-identifier">
                    <Input
                        id="login-identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="ornek@email.com"
                        autoComplete="username"
                        required
                    />
                </Field>

                <Field label="Şifre" htmlFor="login-password">
                    <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        rightSlot={
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                                aria-pressed={showPassword}
                                className={authToggleClass}
                            >
                                {showPassword ? <EyeOff/> : <Eye/>}
                            </button>
                        }
                    />
                </Field>

                <Button type="submit" fullWidth loading={loading} className="mt-1">
                    {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
                </Button>

                {/* Aydınlatma metni onaylatılmaz, yalnızca bilgi verilir */}
                <p className="text-sm leading-relaxed text-fg-muted">
                    Giriş yaparak{' '}
                    <Link href="/kullanim-sartlari" target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                        Kullanım Şartları
                    </Link>
                    &apos;nı kabul etmiş olursunuz. Kişisel verilerinizin nasıl işlendiğini{' '}
                    <Link href="/gizlilik" target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                        Gizlilik ve KVKK Aydınlatma Metni
                    </Link>
                    &apos;nde, kullandığımız zorunlu çerezleri{' '}
                    <Link href="/gizlilik#cerezler" target="_blank" rel="noopener noreferrer" className={authLinkClass}>
                        çerezler
                    </Link>
                    {' '}bölümünde bulabilirsiniz.
                </p>
            </form>
        </AuthShell>
    );
}
