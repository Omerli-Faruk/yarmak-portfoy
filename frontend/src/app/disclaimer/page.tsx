import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, AlertTriangle, Clock, Scale, Info } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Yasal Uyarı & SPK Çekincesi | Yarmak',
    description: 'Yarmak Portföy yasal çekince, SPK uyarısı, 15 dakika gecikmeli veri ve fiyat doğruluğu sorumluluk reddi beyanı.',
};

export default function DisclaimerPage() {
    return (
        <div className="min-h-screen text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Geri Dön Butonu */}
                <div>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Ana Sayfaya Dön
                    </Link>
                </div>

                {/* Başlık Kartı */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Resmi Bilgilendirme ve Feragatname</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Yasal Uyarı & Sorumluluk Reddi Beyanı
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Yarmak platformunu kullanmadan önce lütfen aşağıdaki yasal uyarıları, veri gecikme koşullarını ve sorumluluk sınırlarını dikkatle okuyunuz. Platformu ziyaret eden ve kullanan tüm yatırımcılar bu şartları kabul etmiş sayılır.
                    </p>
                </div>

                {/* İçerik Bölümleri */}
                <div className="space-y-6">
                    {/* 1. SPK Yasal Uyarısı */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Scale className="w-5 h-5 text-slate-300" />
                            <h2>1. Sermaye Piyasası Kurulu (SPK) Yasal Uyarısı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 font-mono">
                            &quot;Burada yer alan yatırım bilgi, yorum ve tavsiyeleri yatırım danışmanlığı kapsamında değildir. Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, mevduat kabul etmeyen bankalar ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır. Burada yer alan yorum ve tavsiyeler, yorum ve tavsiyede bulunanların kişisel görüşlerine dayanmaktadır. Bu görüşler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece burada yer alan bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.&quot;
                        </p>
                    </div>

                    {/* 2. Kesinlikle Yatırım Tavsiyesi Değildir */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldAlert className="w-5 h-5 text-slate-300" />
                            <h2>2. Yatırım Tavsiyesi Niteliğinde Olmama Beyanı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak; herhangi bir hisse senedi, yatırım fonu, döviz, emtia veya kripto varlık için <strong>alım, satım, tutma veya benzeri finansal tavsiye vermez</strong>. Sistemde yer alan fiyat alarmları, getiri yüzdeleri, ağırlıklı ortalama maliyet (AOF) analizleri ve grafiksel gösterimler yalnızca kullanıcının kendi girdiği işlemleri takip etmesi amacıyla matematiksel formüllerle üretilen bilgilendirici araçlardır.
                        </p>
                    </div>

                    {/* 3. Fiyat Doğruluğu & Gerçek Piyasa Farklılıkları */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Info className="w-5 h-5 text-slate-300" />
                            <h2>3. Fiyat Doğruluğu, Simülasyon ve Gerçek Piyasa Farklılıkları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Platformumuzda sunulan piyasa fiyatları, portföy kâr/zarar tutarları ve finansal hesaplamalar her ne kadar azami dikkat, modern algoritmalar ve güvenilir açık veri kaynakları kullanılarak derlense de:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li>
                                Teknik gecikmeler, internet altyapısı kesintileri veya veri sağlayıcı kaynaklı gecikmeler yaşanabilir.
                            </li>
                            <li>
                                Yarmak üzerinde görünen fiyatlar ile aracı kurumunuzdaki anlık gerçekleşen emir (işlem) fiyatları veya kademe derinlikleri arasında anlık farklar oluşabilir.
                            </li>
                            <li>
                                Resmi hesap mutabakatı ve yasal portföy ekstresi için daima yetkili bankanızın veya aracı kurumunuzun resmi kayıtları esas alınmalıdır.
                            </li>
                        </ul>
                    </div>

                    {/* 4. 15 Dakika Gecikmeli Veri Bildirimi */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Clock className="w-5 h-5 text-slate-300" />
                            <h2>4. BIST 15 Dakika Gecikmeli Veri ve TEFAS Kapanışları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Borsa İstanbul (BIST) pay piyasası verileri yasal lisanslama kuralları gereği <strong>en az 15 dakika gecikmeli</strong> olarak sunulmaktadır. TEFAS yatırım fonu fiyatları Takasbank tarafından her iş günü sonu açıklanan resmi fon kapanış değerleridir. Altın ve serbest piyasa döviz kurları ise gösterge niteliğinde olup bankalar arası spread (makas) oranlarını içermeyebilir.
                        </p>
                    </div>

                    {/* 5. Sorumluluk Sınırı */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldAlert className="w-5 h-5 text-slate-300" />
                            <h2>5. Sorumluluğun Sınırlandırılması</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak geliştiricileri ve yöneticileri; platformdaki bilgilerin eksik, hatalı veya gecikmeli olması, sunucu kesintileri veya sistem hataları sebebiyle kullanıcıların ya da üçüncü şahısların uğrayabileceği doğrudan ya da dolaylı maddi ve manevi zararlardan, kâr kayıplarından veya yatırım kararlarından hiçbir suretle hukuki veya cezai olarak sorumlu tutulamaz.
                        </p>
                    </div>
                </div>

                {/* Alt Bilgi */}
                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>Son Güncelleme: 1 Ekim 2026</p>
                    <div className="flex items-center gap-4">
                        <Link href="/terms" className="hover:text-slate-300 transition">Kullanım Şartları</Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-slate-300 transition">Gizlilik Politikası</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
