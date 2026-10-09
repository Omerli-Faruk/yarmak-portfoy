import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, Database, KeyRound, EyeOff, Cookie } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Gizlilik ve KVKK Aydınlatma Metni',
    description: 'Yarmak gizlilik politikası ve KVKK aydınlatma metni: işlenen veriler, çerezler ve haklarınız.',
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
                        Gizlilik ve KVKK Aydınlatma Metni
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında Yarmak&apos;ta hangi kişisel verilerin, hangi amaçla ve nasıl işlendiğini açıklar.
                    </p>
                </div>

                {/* Maddeler */}
                <div className="space-y-6">
                    {/* Madde 1: Banka şifresi istenmez */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <KeyRound className="w-5 h-5 text-slate-400" />
                            <h2>1. Banka ve aracı kurum şifreniz istenmez</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak; banka hesabınıza, MKK (Merkezi Kayıt Kuruluşu) portalına veya aracı kurum hesabınıza bağlanmaz. Açık bankacılık veya hesap yönetim şifrelerinizi <strong>talep etmez ve saklamaz</strong>. Portföyünüzdeki işlem ve temettü kayıtları yalnızca sizin elle girdiğiniz bilgilerden oluşur; fiyatlar piyasa veri kaynaklarından alınır.
                        </p>
                    </div>

                    {/* Madde 2: İşlenen veriler */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Database className="w-5 h-5 text-slate-400" />
                            <h2>2. İşlenen veriler, toplanma yöntemi ve amacı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Sunucuda yalnızca hizmetin gerektirdiği veriler işlenir:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li><strong>Hesap bilgileri:</strong> Kullanıcı adı, e-posta adresi, kayıt tarihi ve geri çözülemeyen bir özet (bcrypt) olarak saklanan şifre.</li>
                            <li><strong>Portföy kayıtları:</strong> Girdiğiniz alım-satım işlemleri (sembol, adet, fiyat, tarih, komisyon), temettü kayıtları, fiyat alarmları ve bunlardan her gün hesaplanan portföy değeri, maliyet ve kâr/zarar özetleri.</li>
                            <li><strong>Oturum kayıtları:</strong> Oturumunuzu yenilemek için kullanılan anahtarın geri çözülemeyen özeti ve geçerlilik süresi.</li>
                            <li><strong>Teknik kayıtlar:</strong> Sunucuya gelen isteklerin IP adresi, zamanı ve istenen adresi sunucu günlüklerine yazılır. IP adresi ayrıca aşırı istekleri sınırlamak için kısa süre bellekte tutulur.</li>
                        </ul>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Bu veriler, kayıt olduğunuzda ve platformu kullandığınızda girdiğiniz bilgilerden ve kullanım sırasında oluşan kayıtlardan elektronik ortamda toplanır. Hesabınızı oluşturmak, oturumunuzu yönetmek, portföy hesaplamalarını size göstermek ve platformu kötüye kullanıma karşı korumak amacıyla; bir sözleşmenin kurulması veya ifası için gerekli olması (KVKK m.5/2-c) ve veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması (KVKK m.5/2-ç) hukuki sebeplerine dayanılarak işlenir.
                        </p>
                    </div>

                    {/* Madde 3: Şifre ve oturum güvenliği */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldCheck className="w-5 h-5 text-slate-400" />
                            <h2>3. Şifre ve oturum güvenliği</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Kullanıcı şifreleri veritabanında açık metin olarak tutulmaz; bcrypt ile geri çözülemeyecek şekilde saklanır. Oturum, JavaScript tarafından okunamayan (HttpOnly) çerezlerle yönetilir.
                        </p>
                    </div>

                    {/* Madde 4: Çerezler ve tarayıcı depolaması */}
                    <div id="cerezler" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 scroll-mt-20">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Cookie className="w-5 h-5 text-slate-400" />
                            <h2>4. Çerezler ve tarayıcı depolaması</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak yalnızca oturumunuzu yönetmek için gereken <strong>zorunlu çerezleri</strong> kullanır:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-400 pl-2">
                            <li><strong>Oturum çerezleri (access_token, refresh_token):</strong> Giriş yaptığınızda iki çerez oluşturulur: 1 saat geçerli erişim çerezi ve 60 gün geçerli yenileme çerezi. İkisi de JavaScript tarafından okunamaz (HttpOnly) ve SameSite=Lax ayarıyla başka sitelerden gelen isteklere karşı sınırlandırılır.</li>
                            <li><strong>Tarayıcıda saklanan tercihler:</strong> Para birimi seçiminiz (TRY/USD), bildirimlerin okundu bilgisi, oluşturduğunuz varlık grupları, sıralama tercihleriniz ve oturum açık olup olmadığı bilgisi yalnızca tarayıcınızda (localStorage) saklanır; sunucuya gönderilmez ve başka cihazlarda görünmez.</li>
                            <li><strong>Reklam ve izleme çerezi yok:</strong> Gezinme alışkanlıklarınızı kaydeden veya üçüncü kişiler için profil çıkaran reklam, pazarlama ya da izleme çerezleri kullanılmaz.</li>
                        </ul>
                    </div>

                    {/* Madde 5: Üçüncü kişilerle paylaşım */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <EyeOff className="w-5 h-5 text-slate-400" />
                            <h2>5. Verilerin üçüncü kişilere aktarılması</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Kullanıcılarımızın portföy büyüklükleri, işlem geçmişleri veya kimlik bilgileri <strong>asla üçüncü taraf reklam şirketlerine, finans kuruluşlarına veya veri simsarlarına satılmaz ya da kiralanmaz</strong>. Veriler yalnızca yasal mevzuat gereği yetkili adli mercilerce talep edildiği hallerde paylaşılabilir.
                        </p>
                    </div>

                    {/* Madde 6: KVKK m.11 hakları */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <Lock className="w-5 h-5 text-slate-400" />
                            <h2>6. KVKK&apos;nın 11. maddesi kapsamındaki haklarınız</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            KVKK&apos;nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK&apos;nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme, düzeltme ve silme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
                        </p>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Başvurularınızı sistemde kayıtlı e-posta adresinizden <a href="mailto:destek@yarmak.com" className="text-white underline hover:text-slate-300">destek@yarmak.com</a> adresine iletebilirsiniz. Başvurular en geç 30 gün içinde sonuçlandırılır; işlem ayrıca bir maliyet gerektirmedikçe ücret alınmaz.
                        </p>
                    </div>
                </div>

                {/* Alt bilgi */}
                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>Son güncelleme: 9 Ekim 2026</p>
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
