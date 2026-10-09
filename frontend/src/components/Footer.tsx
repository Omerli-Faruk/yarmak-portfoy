'use client';

import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { Mail, ShieldAlert } from "lucide-react";

export default function Footer() {
    const { user } = useAuth();

    return (
        <footer className="w-full border-t border-slate-800 bg-[#0A0E14] pt-14 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                    {/* Marka */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Image src="/logo.png" alt="Yarmak Logo" width={26} height={26} className="size-6 object-contain" loading="eager"/>
                            <span className="font-bold text-white text-lg">
                                Yarmak
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mt-1">
                            BIST hisseleri, TEFAS fonları, altın ve döviz yatırımlarınızı tek ekranda takip edin.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Platform</h4>
                        <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-slate-400">
                            <li><Link href="/markets" className="hover:text-white transition-colors">Piyasalar &amp; Keşif</Link></li>
                            <li><Link href="/#ozellikler" className="hover:text-white transition-colors">Özellikler</Link></li>
                            {user ? (
                                <>
                                    <li><Link href="/dashboard" className="hover:text-white transition-colors">Portföyüm</Link></li>
                                    <li><Link href="/holdings" className="hover:text-white transition-colors">Varlıklarım</Link></li>
                                    <li><Link href="/alerts" className="hover:text-white transition-colors">Fiyat Alarmları</Link></li>
                                </>
                            ) : (
                                <li><Link href="/register" className="hover:text-white transition-colors">Ücretsiz Hesap Oluştur</Link></li>
                            )}
                        </ul>
                    </div>

                    {/* Yardım ve yasal metinler */}
                    <div>
                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Kurumsal &amp; Yasal</h4>
                        <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-slate-400">
                            <li><Link href="/#destek" className="hover:text-white transition-colors">Sıkça Sorulan Sorular</Link></li>
                            <li><Link href="/disclaimer" className="hover:text-white transition-colors text-amber-400/90 hover:text-amber-300">Yasal Uyarı &amp; SPK</Link></li>
                            <li><Link href="/terms" className="hover:text-white transition-colors">Kullanım Şartları</Link></li>
                            <li><Link href="/privacy" className="hover:text-white transition-colors">Gizlilik &amp; KVKK</Link></li>
                        </ul>
                    </div>

                    {/* İletişim */}
                    <div>
                        <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">İletişim &amp; Destek</h4>
                        <ul className="flex flex-col gap-2.5 text-xs sm:text-sm text-slate-400">
                            <li className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                <a href="mailto:destek@yarmak.com" className="hover:text-white transition-colors font-mono">destek@yarmak.com</a>
                            </li>
                            <li className="text-xs text-slate-400 pt-2 leading-relaxed">
                                Sorularınız, hata bildirimleri veya önerileriniz için dilediğiniz an e-posta gönderebilirsiniz.
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Yatırım danışmanlığı çekincesi ve veri gecikmesi notu */}
                <div className="pt-6 pb-6 border-t border-slate-800">
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2.5">
                        <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Yasal uyarı ve yatırım danışmanlığı çekincesi</span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed font-mono">
                            Burada yer alan bilgiler yatırım danışmanlığı kapsamında değildir. Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, yatırım ve kalkınma bankaları ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır. Burada yer alan bilgiler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece bu bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-800/60">
                            <strong>Veri gecikmesi ve fiyat farkları:</strong> Borsa İstanbul (BIST) pay piyasası verileri en az 15 dakika gecikmelidir; fon fiyatları TEFAS&apos;ta yayımlanan günlük fiyatlardır. Gösterilen fiyatlar ve getiri hesapları; gecikmeler, veri sağlayıcı kaynaklı hatalar veya yuvarlamalar nedeniyle gerçek işlem fiyatlarından ya da aracı kurum ekstrelerinizden farklı olabilir. Yarmak, içerikteki olası hata, eksiklik veya gecikmelerden kaynaklanabilecek doğrudan ya da dolaylı zararlardan hiçbir suretle sorumlu tutulamaz.
                        </p>
                    </div>
                </div>

                {/* Alt satır */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                    <p>© 2026 Yarmak. Tüm hakları saklıdır.</p>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                        <Link href="/disclaimer" className="hover:text-slate-300 transition">Yasal Uyarı (SPK)</Link>
                        <span>•</span>
                        <Link href="/terms" className="hover:text-slate-300 transition">Kullanım Şartları</Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-slate-300 transition">Gizlilik Politikası</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
