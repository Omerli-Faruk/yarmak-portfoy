import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, Database, KeyRound, EyeOff, Cookie } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Gizlilik & KVKK Politikası | Yarmak',
    description: 'Yarmak Portföy kişisel veri koruma (KVKK), güvenlik ve gizlilik politikası.',
};

export default function PrivacyPage() {
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Kişisel Verilerin Korunması</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Gizlilik &amp; KVKK Aydınlatma Metni
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Yarmak olarak kullanıcılarımızın gizliliğini ve kişisel verilerinin güvenliğini en temel önceliğimiz olarak kabul ediyoruz. 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında verilerinizin işlenme ilkeleri aşağıda açıklanmıştır.
                    </p>
                </div>

                {/* Maddeler */}
                <div className="space-y-6">
                    {/* Madde 1: Banka Şifresi İstenmez */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <KeyRound className="w-5 h-5 text-slate-400" />
                            <h2>1. Sıfır Yetki Prensibi: Banka Şifresi Asla İstenmez</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak, kullanıcıların hiçbir banka hesabına, MKK (Merkezi Kayıt Kuruluşu) portalına veya aracı kurum hesaplarına doğrudan bağlanmaz; açık bankacılık veya hesap yönetim şifrelerinizi <strong>kesinlikle talep etmez ve saklamaz</strong>. Portföyünüzde gördüğünüz tüm veriler, yalnızca sizin el ile sisteme girdiğiniz alım-satım ve temettü kayıtlarından ibarettir.
                        </p>
                    </div>

                    {/* Madde 2: Toplanan Veriler */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Database className="w-5 h-5 text-slate-400" />
                            <h2>2. İşlenen Veriler ve Toplanma Amacı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Platformda yalnızca hizmetin gerektirdiği asgari veriler işlenmektedir:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li><strong>Hesap Bilgileri:</strong> Kullanıcı adı, e-posta adresi ve tek yönlü kriptografik özet (bcrypt hash) olarak saklanan şifre.</li>
                            <li><strong>Portföy Kayıtları:</strong> Kullanıcının bizzat girdiği işlem geçmişi (sembol, lot adedi, maliyet fiyatı, tarih, komisyon ve temettü kayıtları).</li>
                            <li><strong>Tercih ve Ayarlar:</strong> Para birimi tercihi (TRY/USD), kullanıcı bazlı fiyat alarmları ve okundu durumları.</li>
                        </ul>
                    </div>

                    {/* Madde 3: Veri Güvenliği ve Şifreleme */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldCheck className="w-5 h-5 text-slate-400" />
                            <h2>3. Güvenlik Standartları ve Şifreleme</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Kullanıcı parolaları veritabanında asla açık metin olarak tutulmaz, güçlü endüstri standardı tuzlanmış hash (bcrypt) algoritmalarıyla korunur. Oturum yönetimi güvenli, HttpOnly ve SameSite korumalı JWT çerezleri (cookie) ile sağlanır. Tüm veri iletimi modern SSL/TLS (HTTPS) protokolü ile şifrelenir.
                        </p>
                    </div>

                    {/* Madde 4: Çerezler (Cookies) ve Oturum Politikası */}
                    <div id="cerezler" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 scroll-mt-20">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Cookie className="w-5 h-5 text-slate-400" />
                            <h2>4. Çerezler (Cookies) ve Oturum Güvenliği</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak platformu, kullanıcı deneyimini sağlamak ve hesap güvenliğini korumak amacıyla yalnızca <strong>zorunlu teknik çerezler</strong> kullanmaktadır:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li><strong>Güvenli Oturum Çerezi (refresh_token):</strong> Giriş yaptığınızda oluşturulan, tarayıcıda JavaScript tarafından okunamayan (HttpOnly), yalnızca şifreli HTTPS kanalı üzerinden aktarılan (Secure) ve CSRF saldırılarına karşı korumalı (SameSite) oturum çerezidir.</li>
                            <li><strong>Arayüz Tercih Verileri:</strong> Para birimi seçiminiz (TRY/USD) veya bildirim paneli okundu kayıtları gibi kullanıcı deneyimi ayarları yerel tarayıcı hafızasında (localStorage) saklanır.</li>
                            <li><strong>Sıfır Reklam ve Sıfır Takipçi:</strong> Platformumuzda kullanıcıların gezinme alışkanlıklarını kaydeden veya üçüncü şahıslara profil çıkaran hiçbir reklam, pazarlama ya da üçüncü taraf izleme çerezi (tracking cookie) KULLANILMAZ.</li>
                        </ul>
                    </div>

                    {/* Madde 5: Üçüncü Taraflarla Paylaşım */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <EyeOff className="w-5 h-5 text-slate-400" />
                            <h2>5. Verilerin Üçüncü Şahıslara Aktarılmaması</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Kullanıcılarımızın portföy büyüklükleri, işlem geçmişleri veya kimlik bilgileri <strong>asla üçüncü taraf reklam şirketlerine, finans kuruluşlarına veya veri simsarlarına satılmaz ya da kiralanmaz</strong>. Veriler yalnızca yasal mevzuat gereği yetkili adli mercilerce talep edildiği hallerde paylaşılabilir.
                        </p>
                    </div>

                    {/* Madde 6: KVKK Kapsamındaki Haklarınız */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Lock className="w-5 h-5 text-slate-400" />
                            <h2>6. KVKK Kanunu (Madde 11) Kapsamındaki Haklarınız</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            KVKK&apos;nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenme amacına uygun kullanılıp kullanılmadığını sorgulama, yanlış işlenmişse düzeltilmesini talep etme ve dilediğiniz an verilerinizin tamamen silinmesini veya hesabınızın kapatılmasını talep etme hakkına sahipsiniz. Başvurularınızı <a href="mailto:destek@yarmak.com" className="text-white underline hover:text-slate-300">destek@yarmak.com</a> üzerinden iletebilirsiniz.
                        </p>
                    </div>
                </div>

                {/* Alt Bilgi */}
                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>Son Güncelleme: 1 Ekim 2026</p>
                    <div className="flex items-center gap-4">
                        <Link href="/terms" className="hover:text-slate-300 transition">Kullanım Şartları</Link>
                        <span>•</span>
                        <Link href="/disclaimer" className="hover:text-slate-300 transition">Yasal Uyarı (SPK)</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
