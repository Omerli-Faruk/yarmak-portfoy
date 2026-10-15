import type { Metadata } from 'next';
import LegalDocument, { LegalSection, legalTextClass, legalListClass } from '../terms/LegalDocument';

export const metadata: Metadata = {
    title: 'Gizlilik ve KVKK Aydınlatma Metni',
    description: 'Yarmak gizlilik politikası ve KVKK aydınlatma metni: işlenen veriler, çerezler ve haklarınız.',
};

export default function PrivacyPage() {
    return (
        <LegalDocument
            title="Gizlilik ve KVKK Aydınlatma Metni"
            updated={{ dateTime: '2026-10-09', label: '9 Ekim 2026' }}
            intro={
                <>
                    Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında Yarmak&apos;ta hangi kişisel verilerin, hangi amaçla ve nasıl işlendiğini açıklar.
                </>
            }
        >
            <LegalSection title="Banka ve aracı kurum şifreniz istenmez">
                <p className={legalTextClass}>
                    Yarmak; banka hesabınıza, MKK (Merkezi Kayıt Kuruluşu) portalına veya aracı kurum hesabınıza bağlanmaz. Açık bankacılık veya hesap yönetim şifrelerinizi <strong>talep etmez ve saklamaz</strong>. Portföyünüzdeki işlem ve temettü kayıtları yalnızca sizin elle girdiğiniz bilgilerden oluşur; fiyatlar piyasa veri kaynaklarından alınır.
                </p>
            </LegalSection>

            <LegalSection title="İşlenen veriler, toplanma yöntemi ve amacı">
                <p className={legalTextClass}>
                    Sunucuda yalnızca hizmetin gerektirdiği veriler işlenir:
                </p>
                <ul className={legalListClass}>
                    <li><strong>Hesap bilgileri:</strong> Kullanıcı adı, e-posta adresi, kayıt tarihi ve geri çözülemeyen bir özet (bcrypt) olarak saklanan şifre.</li>
                    <li><strong>Portföy kayıtları:</strong> Girdiğiniz alım-satım işlemleri (sembol, adet, fiyat, tarih, komisyon), temettü kayıtları, fiyat alarmları ve bunlardan her gün hesaplanan portföy değeri, maliyet ve kâr/zarar özetleri.</li>
                    <li><strong>Oturum kayıtları:</strong> Oturumunuzu yenilemek için kullanılan anahtarın geri çözülemeyen özeti ve geçerlilik süresi.</li>
                    <li><strong>Teknik kayıtlar:</strong> Sunucuya gelen isteklerin IP adresi, zamanı ve istenen adresi sunucu günlüklerine yazılır. IP adresi ayrıca aşırı istekleri sınırlamak için kısa süre bellekte tutulur.</li>
                </ul>
                <p className={legalTextClass}>
                    Bu veriler, kayıt olduğunuzda ve platformu kullandığınızda girdiğiniz bilgilerden ve kullanım sırasında oluşan kayıtlardan elektronik ortamda toplanır. Hesabınızı oluşturmak, oturumunuzu yönetmek, portföy hesaplamalarını size göstermek ve platformu kötüye kullanıma karşı korumak amacıyla; bir sözleşmenin kurulması veya ifası için gerekli olması (KVKK m.5/2-c) ve veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması (KVKK m.5/2-ç) hukuki sebeplerine dayanılarak işlenir.
                </p>
            </LegalSection>

            <LegalSection title="Şifre ve oturum güvenliği">
                <p className={legalTextClass}>
                    Kullanıcı şifreleri veritabanında açık metin olarak tutulmaz; bcrypt ile geri çözülemeyecek şekilde saklanır. Oturum, JavaScript tarafından okunamayan (HttpOnly) çerezlerle yönetilir.
                </p>
            </LegalSection>

            {/* Giriş ekranındaki "çerezler" bağlantısı bu bölüme gelir */}
            <LegalSection id="cerezler" title="Çerezler ve tarayıcı depolaması">
                <p className={legalTextClass}>
                    Yarmak yalnızca oturumunuzu yönetmek için gereken <strong>zorunlu çerezleri</strong> kullanır:
                </p>
                <ul className={legalListClass}>
                    <li><strong>Oturum çerezleri (<code className="font-mono text-sm">access_token</code>, <code className="font-mono text-sm">refresh_token</code>):</strong> Giriş yaptığınızda iki çerez oluşturulur: 1 saat geçerli erişim çerezi ve 60 gün geçerli yenileme çerezi. İkisi de JavaScript tarafından okunamaz (HttpOnly) ve SameSite=Lax ayarıyla başka sitelerden gelen isteklere karşı sınırlandırılır.</li>
                    <li><strong>Tarayıcıda saklanan tercihler:</strong> Para birimi seçiminiz (TRY/USD), bildirimlerin okundu bilgisi, oluşturduğunuz varlık grupları, sıralama tercihleriniz ve oturum açık olup olmadığı bilgisi yalnızca tarayıcınızda (localStorage) saklanır; sunucuya gönderilmez ve başka cihazlarda görünmez.</li>
                    <li><strong>Reklam ve izleme çerezi yok:</strong> Gezinme alışkanlıklarınızı kaydeden veya üçüncü kişiler için profil çıkaran reklam, pazarlama ya da izleme çerezleri kullanılmaz.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Verilerin üçüncü kişilere aktarılması">
                <p className={legalTextClass}>
                    Kullanıcılarımızın portföy büyüklükleri, işlem geçmişleri veya kimlik bilgileri <strong>asla üçüncü taraf reklam şirketlerine, finans kuruluşlarına veya veri simsarlarına satılmaz ya da kiralanmaz</strong>. Veriler yalnızca yasal mevzuat gereği yetkili adli mercilerce talep edildiği hallerde paylaşılabilir.
                </p>
            </LegalSection>

            <LegalSection title={<>KVKK&apos;nın 11. maddesi kapsamındaki haklarınız</>}>
                <p className={legalTextClass}>
                    KVKK&apos;nın 11. maddesi uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK&apos;nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme, düzeltme ve silme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
                </p>
                <p className={legalTextClass}>
                    Başvurularınızı, kullandığınız Yarmak kurulumunu işleten kişiye iletebilirsiniz. Başvurular en geç 30 gün içinde sonuçlandırılır; işlem ayrıca bir maliyet gerektirmedikçe ücret alınmaz.
                </p>
            </LegalSection>
        </LegalDocument>
    );
}
