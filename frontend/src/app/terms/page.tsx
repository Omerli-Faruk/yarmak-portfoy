import Link from 'next/link';
import type { Metadata } from 'next';
import LegalDocument, { LegalSection, legalTextClass, legalInlineLinkClass } from './LegalDocument';

export const metadata: Metadata = {
    title: 'Kullanım Şartları',
    description: 'Yarmak portföy takip aracının kullanıcı sözleşmesi ve kullanım şartları.',
};

export default function TermsPage() {
    return (
        <LegalDocument
            title="Kullanım Şartları"
            updated={{ dateTime: '2026-10-09', label: '9 Ekim 2026' }}
            intro={
                <>
                    Yarmak&apos;a kayıt olarak bu Kullanım Şartları&apos;nı kabul etmiş olursunuz. Kişisel verilerinizin nasıl işlendiği{' '}
                    <Link href="/privacy" className={legalInlineLinkClass}>Gizlilik ve KVKK Aydınlatma Metni</Link>
                    &apos;nde açıklanmıştır. Lütfen hizmet kapsamını ve yükümlülüklerinizi dikkatle inceleyiniz.
                </>
            }
        >
            <LegalSection title="Hizmetin niteliği ve kapsamı">
                <p className={legalTextClass}>
                    Yarmak; yatırımcıların Borsa İstanbul (BIST), TEFAS yatırım fonları, altın ve döviz pozisyonlarını tek bir arayüzde takip edebilmeleri amacıyla geliştirilmiş bağımsız bir <strong>portföy takip aracıdır</strong>. Yarmak bir banka, aracı kurum, portföy yönetim şirketi veya yatırım kuruluşu değildir; sermaye piyasası emir iletimi, saklama veya aracılık faaliyeti icra etmez.
                </p>
            </LegalSection>

            <LegalSection title="Yatırım tavsiyesi ve fiyat farklılıkları">
                <p className={legalTextClass}>
                    Platformda görüntülenen hiçbir veri, grafik, getiri analizi veya kullanıcı bildirimi <strong>yatırım tavsiyesi niteliği taşımaz</strong>. Fiyatlar ve hesaplamalar ne kadar titizlikle sağlansa da teknik gecikmeler ve veri sağlayıcı kaynaklı farklılıklar içerebilir; gerçek işlem fiyatları veya resmi hesap ekstrelerinizle uyuşmayabilir. Yatırım kararları tamamen kullanıcının kendi hür iradesine aittir.
                </p>
            </LegalSection>

            <LegalSection title="Hesap güvenliği ve kullanıcı yükümlülükleri">
                <p className={legalTextClass}>
                    Kullanıcı, oluşturduğu hesabın ve giriş bilgilerinin gizliliğini korumakla yükümlüdür. Yarmak, kullanıcıdan hiçbir koşulda banka veya aracı kurum şifresi talep etmez. Kullanıcıların platformu hukuka aykırı, haksız kazanç sağlamaya yönelik veya sistemin işleyişini bozacak şekilde (otomatik botlar, DoS saldırıları vb.) kullanması yasaktır.
                </p>
            </LegalSection>

            <LegalSection title="Fikri mülkiyet hakları">
                <p className={legalTextClass}>
                    Yarmak&apos;ın kaynak kodu MIT lisansıyla yayımlanır. Kodu kopyalayabilir, değiştirebilir ve dağıtabilirsiniz; bunu yaparken lisans metnini ve telif bildirimini korumanız gerekir.
                </p>
            </LegalSection>

            <LegalSection title="Hizmette değişiklik ve fesih">
                <p className={legalTextClass}>
                    Yarmak, platform özelliklerini önceden bildirmeksizin güncelleme, değiştirme veya askıya alma hakkını saklı tutar. Kullanıcı dilediği zaman, kullandığı Yarmak kurulumunu işleten kişiden hesabının kapatılmasını ve verilerinin silinmesini isteyebilir.
                </p>
            </LegalSection>
        </LegalDocument>
    );
}
