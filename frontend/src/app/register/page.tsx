'use client'

import {useAuth} from "@/context/AuthContext";
import React, {useState} from "react";
import axios from "axios";
import Link from "next/link";
import {Eye, EyeOff, AlertCircle} from "lucide-react";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthShell, {authLinkClass, authSwitchLinkClass, authToggleClass} from "../login/AuthShell";

const checkboxClass = "mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Şifre alanının sağındaki göster/gizle düğmesi
function PasswordToggle({visible, onToggle}: { visible: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={visible}
            className={authToggleClass}
        >
            {visible ? <EyeOff/> : <Eye/>}
        </button>
    );
}

export default function RegisterPage() {
    const {register} = useAuth();
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedKVKK, setAcceptedKVKK] = useState(false);


    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        setError('')
        if (username.trim().length < 3 || username.trim().length > 15) {
            setError("Kullanıcı adı 3-15 karakter olmalı; yalnızca harf (ç, ğ, ı, ö, ş, ü hariç), rakam ve alt çizgi (_) içerebilir.");
            return;
        }
        if (password.trim().length < 8 || password.trim().length > 72) {
            setError("Şifreniz 8 ile 72 karakter arasında olmalıdır.");
            return;
        }
        if (password.trim() !== passwordConfirm.trim()) {
            setError("Şifreler eşleşmiyor.");
            return;
        }
        if (!acceptedTerms) {
            setError("Devam etmek için Kullanım Şartları'nı ve Yasal Uyarı'yı kabul etmeniz gerekiyor.");
            return;
        }
        if (!acceptedKVKK) {
            setError("Devam etmek için Gizlilik Politikası ve KVKK Aydınlatma Metni'ni okuduğunuzu işaretlemeniz gerekiyor.");
            return;
        }
        setLoading(true);
        try {
            await register(email, password, username);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || "Kayıt yapılırken bir hata oluştu.");
            } else {
                setError("Beklenmeyen bir hata oluştu.");
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthShell
            title="Portföyünüzü oluşturun"
            footer={
                <>
                    <span>Zaten bir hesabınız var mı?</span>
                    <Link href="/login" className={authSwitchLinkClass}>
                        Giriş yap
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                    <div role="alert" className="flex items-start gap-2 rounded bg-loss-soft px-3 py-2.5 text-sm text-loss">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/>
                        <span>{error}</span>
                    </div>
                )}

                <Field label="Kullanıcı adı" htmlFor="register-username">
                    <Input
                        id="register-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="kullanici_adi"
                        maxLength={15}
                        autoComplete="username"
                        required
                    />
                </Field>

                <Field label="E-posta" htmlFor="register-email">
                    <Input
                        id="register-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ornek@email.com"
                        autoComplete="email"
                        required
                    />
                </Field>

                <Field label="Şifre" htmlFor="register-password">
                    <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        rightSlot={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)}/>}
                    />
                </Field>

                <Field label="Şifre tekrarı" htmlFor="register-password-confirm">
                    <Input
                        id="register-password-confirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        rightSlot={<PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)}/>}
                    />
                </Field>

                {/* Kullanım şartları kabul edilir; aydınlatma metni için yalnızca okunduğu işaretlenir. İkisi ayrı tutulur. */}
                <div className="flex flex-col gap-3 pt-1">
                    <label className="flex cursor-pointer select-none items-start gap-3 text-sm leading-relaxed text-fg">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className={checkboxClass}
                            required
                        />
                        <span>
                            <Link
                                href="/terms"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={authLinkClass}
                            >
                                Kullanım Şartları
                            </Link>
                            &apos;nı ve{' '}
                            <Link
                                href="/disclaimer"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={authLinkClass}
                            >
                                Yasal Uyarı
                            </Link>
                            &apos;yı okudum, kabul ediyorum.
                        </span>
                    </label>

                    <label className="flex cursor-pointer select-none items-start gap-3 text-sm leading-relaxed text-fg">
                        <input
                            type="checkbox"
                            checked={acceptedKVKK}
                            onChange={(e) => setAcceptedKVKK(e.target.checked)}
                            className={checkboxClass}
                            required
                        />
                        <span>
                            <Link
                                href="/privacy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={authLinkClass}
                            >
                                Gizlilik Politikası ve KVKK Aydınlatma Metni
                            </Link>
                            &apos;ni okudum, anladım.
                        </span>
                    </label>
                </div>

                <Button type="submit" fullWidth loading={loading} className="mt-1">
                    {loading ? 'Hesap oluşturuluyor...' : 'Ücretsiz kayıt ol'}
                </Button>
            </form>
        </AuthShell>
    );
}
