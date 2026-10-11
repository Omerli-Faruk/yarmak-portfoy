'use client';

import Link from "next/link";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { cn } from "@/lib/cn";
import Disclosure from "@/components/ui/Disclosure";

// Bağlantılar 13-15px ve dokunmaya uygun yükseklikte (mobilde 44px, masaüstünde 40px)
const linkClass = "inline-flex items-center min-h-11 sm:min-h-10 hover:text-fg transition-colors duration-[120ms]";

// Sakin alt bilgi: marka + bağlantılar tek satır. Yasal uyarının ilk cümleleri görünür, devamı açılır bölümde;
// metnin hiçbir cümlesi iki kez yazılmaz, hiçbiri kısaltılmaz.
export default function Footer() {
    const { user } = useAuth();

    return (
        // Giriş yapılmışsa mobilde alt sekme çubuğu için ek boşluk bırakılır
        <footer className={cn("w-full border-t border-border mt-auto", user ? "pb-20 sm:pb-0" : "pb-0")}>
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4 text-xs text-fg-muted">
                {/* Marka ve bağlantılar */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                    <div className="flex items-center gap-2 min-w-0">
                        <Image src="/logo.png" alt="Yarmak Logo" width={20} height={20} className="size-5 object-contain" loading="eager"/>
                        <span className="font-display text-base font-bold text-fg tracking-tight">yarmak</span>
                    </div>
                    <nav aria-label="Alt menü" className="flex flex-wrap items-center gap-x-5 text-sm">
                        <Link href="/markets" className={linkClass}>Piyasalar</Link>
                        {user ? (
                            <>
                                <Link href="/dashboard" className={linkClass}>Portföyüm</Link>
                                <Link href="/holdings" className={linkClass}>Varlıklarım</Link>
                                <Link href="/alerts" className={linkClass}>Alarmlar</Link>
                            </>
                        ) : (
                            <Link href="/#ozellikler" className={linkClass}>Özellikler</Link>
                        )}
                        <Link href="/#destek" className={linkClass}>Sıkça sorulan sorular</Link>
                        <a href="mailto:destek@yarmak.com" className={linkClass} title="Sorularınız, hata bildirimleri veya önerileriniz için dilediğiniz an e-posta gönderebilirsiniz.">
                            destek@yarmak.com
                        </a>
                    </nav>
                </div>

                {/* Yasal çekince: iki paragrafın ilk cümleleri hep görünür, devamları açılır bölümde (tekrar yok) */}
                <div className="flex flex-col gap-1 text-xs leading-relaxed">
                    <p>
                        <strong className="font-medium text-fg">Yasal uyarı: </strong>
                        Burada yer alan bilgiler yatırım danışmanlığı kapsamında değildir.
                        {' '}Borsa İstanbul (BIST) pay piyasası verileri en az 15 dakika gecikmelidir; fon fiyatları TEFAS&apos;ta yayımlanan günlük fiyatlardır.
                    </p>
                    <Disclosure
                        summary="Yasal uyarının devamı"
                        className="[&>summary]:text-xs"
                        contentClassName="gap-2 pt-1"
                    >
                        <p>
                            <strong className="font-medium text-fg">Yatırım danışmanlığı çekincesi: </strong>
                            Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, yatırım ve kalkınma bankaları ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır. Burada yer alan bilgiler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece bu bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.
                        </p>
                        <p>
                            <strong className="font-medium text-fg">Veri gecikmesi ve fiyat farkları: </strong>
                            Gösterilen fiyatlar ve getiri hesapları; gecikmeler, veri sağlayıcı kaynaklı hatalar veya yuvarlamalar nedeniyle gerçek işlem fiyatlarından ya da aracı kurum ekstrelerinizden farklı olabilir. Yarmak, içerikteki olası hata, eksiklik veya gecikmelerden kaynaklanabilecek doğrudan ya da dolaylı zararlardan hiçbir suretle sorumlu tutulamaz.
                        </p>
                    </Disclosure>
                </div>

                {/* Telif ve yasal bağlantılar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-4 pt-3 border-t border-border text-xs">
                    <p>© 2026 Yarmak. Tüm hakları saklıdır.</p>
                    <div className="flex flex-wrap items-center gap-x-5">
                        <Link href="/disclaimer" className={`${linkClass} text-warning hover:underline`}>Yasal uyarı &amp; SPK</Link>
                        <Link href="/terms" className={linkClass}>Kullanım şartları</Link>
                        <Link href="/privacy" className={linkClass}>Gizlilik &amp; KVKK</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
