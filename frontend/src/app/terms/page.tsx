import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Kullanım Şartları',
    description: 'Yarmak portföy takip aracının kullanıcı sözleşmesi ve kullanım şartları.',
};

export default function TermsPage() {
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
                        <FileText className="w-3.5 h-3.5" />
                        <span>Kullanıcı Sözleşmesi</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Kullanım Şartları
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Yarmak&apos;a kayıt olarak bu Kullanım Şartları&apos;nı kabul etmiş olursunuz. Kişisel verilerinizin nasıl işlendiği{' '}
                        <Link href="/privacy" className="text-white underline hover:text-slate-300">Gizlilik ve KVKK Aydınlatma Metni</Link>
                        &apos;nde açıklanmıştır. Lütfen hizmet kapsamını ve yükümlülüklerinizi dikkatle inceleyiniz.
                    </p>
                </div>

                {/* Maddeler */}
                <div className="space-y-6">
                    {/* Madde 1 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <CheckCircle className="w-5 h-5 text-slate-400" />
                            <h2>1. Hizmetin niteliği ve kapsamı</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak; yatırımcıların Borsa İstanbul (BIST), TEFAS yatırım fonları, altın ve döviz pozisyonlarını tek bir arayüzde takip edebilmeleri amacıyla geliştirilmiş bağımsız bir <strong>portföy takip aracıdır</strong>. Yarmak bir banka, aracı kurum, portföy yönetim şirketi veya yatırım kuruluşu değildir; sermaye piyasası emir iletimi, saklama veya aracılık faaliyeti icra etmez.
                        </p>
                    </div>

                    {/* Madde 2 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <AlertCircle className="w-5 h-5 text-slate-400" />
                            <h2>2. Yatırım tavsiyesi ve fiyat farklılıkları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Platformda görüntülenen hiçbir veri, grafik, getiri analizi veya kullanıcı bildirimi <strong>yatırım tavsiyesi niteliği taşımaz</strong>. Fiyatlar ve hesaplamalar ne kadar titizlikle sağlansa da teknik gecikmeler ve veri sağlayıcı kaynaklı farklılıklar içerebilir; gerçek işlem fiyatları veya resmi hesap ekstrelerinizle uyuşmayabilir. Yatırım kararları tamamen kullanıcının kendi hür iradesine aittir.
                        </p>
                    </div>

                    {/* Madde 3 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <ShieldCheck className="w-5 h-5 text-slate-400" />
                            <h2>3. Hesap güvenliği ve kullanıcı yükümlülükleri</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Kullanıcı, oluşturduğu hesabın ve giriş bilgilerinin gizliliğini korumakla yükümlüdür. Yarmak, kullanıcıdan hiçbir koşulda banka veya aracı kurum şifresi talep etmez. Kullanıcıların platformu hukuka aykırı, haksız kazanç sağlamaya yönelik veya sistemin işleyişini bozacak şekilde (otomatik botlar, DoS saldırıları vb.) kullanması yasaktır.
                        </p>
                    </div>

                    {/* Madde 4 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <h2>4. Fikri mülkiyet hakları</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak arayüz tasarımı, logo, yazılım kodları, portföy hesaplama algoritmaları ve platform mimarisi fikri mülkiyet mevzuatıyla korunmaktadır. Yazılı izin olmaksızın platformun kopyalanması, tersine mühendisliğe tabi tutulması veya ticari amaçla izinsiz dağıtılması yasaktır.
                        </p>
                    </div>

                    {/* Madde 5 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center gap-2.5 text-white font-bold text-base">
                            <AlertCircle className="w-5 h-5 text-slate-400" />
                            <h2>5. Hizmette değişiklik ve fesih</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                            Yarmak, platform özelliklerini önceden bildirmeksizin güncelleme, değiştirme veya askıya alma hakkını saklı tutar. Kullanıcı dilediği zaman kayıtlı e-posta adresinden <a href="mailto:destek@yarmak.com" className="text-white underline hover:text-slate-300">destek@yarmak.com</a> adresine yazarak hesabının kapatılmasını ve verilerinin silinmesini isteyebilir.
                        </p>
                    </div>
                </div>

                {/* Alt Bilgi */}
                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    <p>Son güncelleme: 9 Ekim 2026</p>
                    <div className="flex items-center gap-4">
                        <Link href="/disclaimer" className="hover:text-slate-300 transition">Yasal Uyarı (SPK)</Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-slate-300 transition">Gizlilik Politikası</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
