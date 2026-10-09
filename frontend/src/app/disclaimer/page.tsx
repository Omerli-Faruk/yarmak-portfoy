import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, AlertTriangle, Clock, Scale, Info } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Yasal Uyarı ve SPK Çekincesi',
    description: 'Yarmak yasal uyarı, yatırım danışmanlığı çekincesi, 15 dakika gecikmeli veri ve sorumluluk reddi beyanı.',
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
                        <span>Bilgilendirme ve sorumluluk reddi</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Yasal Uyarı ve Sorumluluk Reddi Beyanı
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Yarmak&apos;ı kullanmadan önce lütfen aşağıdaki yasal uyarıları, veri gecikme koşullarını ve sorumluluk sınırlarını okuyunuz.
                    </p>
                </div>

                {/* İçerik Bölümleri */}
                <div className="space-y-6">
                    {/* 1. Yatırım danışmanlığı çekincesi */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Scale className="w-5 h-5 text-slate-300" />
                            <h2>1. Yatırım danışmanlığı çekincesi</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 font-mono">
                            &quot;Burada yer alan bilgiler yatırım danışmanlığı kapsamında değildir. Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, yatırım ve kalkınma bankaları ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır. Burada yer alan bilgiler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece bu bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.&quot;
                        </p>
                    </div>

                    {/* 2. Yatırım tavsiyesi değildir */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldAlert className="w-5 h-5 text-slate-300" />
                            <h2>2. Yatırım tavsiyesi niteliğinde olmama beyanı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak; herhangi bir hisse senedi, yatırım fonu, döviz, emtia veya kripto varlık için <strong>alım, satım, tutma veya benzeri finansal tavsiye vermez</strong>. Sistemde yer alan fiyat alarmları, getiri yüzdeleri, ağırlıklı ortalama maliyet hesapları ve grafikler yalnızca kullanıcının kendi girdiği işlemleri takip etmesi için üretilen bilgilendirici araçlardır.
                        </p>
                    </div>

                    {/* 3. Fiyat doğruluğu */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Info className="w-5 h-5 text-slate-300" />
                            <h2>3. Fiyat doğruluğu ve gerçek piyasa farklılıkları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Platformda sunulan piyasa fiyatları, portföy kâr/zarar tutarları ve finansal hesaplamalar her ne kadar dikkatle ve açık veri kaynakları kullanılarak derlense de:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li>
                                Teknik gecikmeler, internet altyapısı kesintileri veya veri sağlayıcı kaynaklı gecikmeler yaşanabilir.
                            </li>
                            <li>
                                Yarmak&apos;ta görünen fiyatlar ile aracı kurumunuzda gerçekleşen işlem fiyatları arasında farklar oluşabilir.
                            </li>
                            <li>
                                Resmi hesap mutabakatı ve yasal portföy ekstresi için daima yetkili bankanızın veya aracı kurumunuzun resmi kayıtları esas alınmalıdır.
                            </li>
                        </ul>
                    </div>

                    {/* 4. Veri kaynakları ve gecikme */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Clock className="w-5 h-5 text-slate-300" />
                            <h2>4. Veri gecikmesi ve fon fiyatları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Borsa İstanbul (BIST) pay piyasası verileri <strong>en az 15 dakika gecikmelidir</strong>. Fon fiyatları, fonun kurucusu tarafından hesaplanıp Takasbank&apos;ın işlettiği TEFAS&apos;ta yayımlanan günlük birim pay fiyatlarıdır ve sisteme genellikle aynı akşam alınır. Gram altın fiyatı serbest piyasa satış fiyatıdır; bu kaynağa ulaşılamadığında ons altın fiyatı ve USD/TRY kurundan hesaplanır. Döviz kurları gösterge niteliğindedir ve bankanızın alış-satış fiyatlarından farklı olabilir.
                        </p>
                    </div>

                    {/* 5. Sorumluluk sınırı */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldAlert className="w-5 h-5 text-slate-300" />
                            <h2>5. Sorumluluğun sınırlandırılması</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak geliştiricileri ve yöneticileri; platformdaki bilgilerin eksik, hatalı veya gecikmeli olması, sunucu kesintileri veya sistem hataları sebebiyle kullanıcıların ya da üçüncü şahısların uğrayabileceği doğrudan ya da dolaylı maddi ve manevi zararlardan, kâr kayıplarından veya yatırım kararlarından hiçbir suretle hukuki veya cezai olarak sorumlu tutulamaz.
                        </p>
                    </div>
                </div>

                {/* Alt Bilgi */}
                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>Son güncelleme: 9 Ekim 2026</p>
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
