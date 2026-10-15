import type { Metadata } from 'next';
import LegalDocument, { LegalSection, legalTextClass, legalListClass } from '../kullanim-sartlari/LegalDocument';

export const metadata: Metadata = {
    title: 'Yasal Uyarı ve SPK Çekincesi',
    description: 'Yarmak yasal uyarı, yatırım danışmanlığı çekincesi, 15 dakika gecikmeli veri ve sorumluluk reddi beyanı.',
};

export default function DisclaimerPage() {
    return (
        <LegalDocument
            title="Yasal Uyarı ve Sorumluluk Reddi Beyanı"
            updated={{ dateTime: '2026-10-09', label: '9 Ekim 2026' }}
            intro={
                <>
                    Yarmak&apos;ı kullanmadan önce lütfen aşağıdaki yasal uyarıları, veri gecikme koşullarını ve sorumluluk sınırlarını okuyunuz.
                </>
            }
        >
            {/* SPK'nın öngördüğü metin, aynen alıntılanır */}
            <LegalSection title="Yatırım danışmanlığı çekincesi">
                <blockquote className="border-l-2 border-warning pl-3 text-base leading-7 text-fg sm:pl-4">
                    &quot;Burada yer alan bilgiler yatırım danışmanlığı kapsamında değildir. Yatırım danışmanlığı hizmeti; aracı kurumlar, portföy yönetim şirketleri, yatırım ve kalkınma bankaları ile müşteri arasında imzalanacak yatırım danışmanlığı sözleşmesi çerçevesinde sunulmaktadır. Burada yer alan bilgiler mali durumunuz ile risk ve getiri tercihlerinize uygun olmayabilir. Bu nedenle, sadece bu bilgilere dayanılarak yatırım kararı verilmesi beklentilerinize uygun sonuçlar doğurmayabilir.&quot;
                </blockquote>
            </LegalSection>

            <LegalSection title="Yatırım tavsiyesi niteliğinde olmama beyanı">
                <p className={legalTextClass}>
                    Yarmak; herhangi bir hisse senedi, yatırım fonu, döviz, emtia veya kripto varlık için <strong>alım, satım, tutma veya benzeri finansal tavsiye vermez</strong>. Sistemde yer alan fiyat alarmları, getiri yüzdeleri, ağırlıklı ortalama maliyet hesapları ve grafikler yalnızca kullanıcının kendi girdiği işlemleri takip etmesi için üretilen bilgilendirici araçlardır.
                </p>
            </LegalSection>

            <LegalSection title="Fiyat doğruluğu ve gerçek piyasa farklılıkları">
                <p className={legalTextClass}>
                    Platformda sunulan piyasa fiyatları, portföy kâr/zarar tutarları ve finansal hesaplamalar her ne kadar dikkatle ve açık veri kaynakları kullanılarak derlense de:
                </p>
                <ul className={legalListClass}>
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
            </LegalSection>

            <LegalSection title="Veri gecikmesi ve fon fiyatları">
                <p className={legalTextClass}>
                    Borsa İstanbul (BIST) pay piyasası verileri <strong>en az 15 dakika gecikmelidir</strong>. Fon fiyatları, fonun kurucusu tarafından hesaplanıp Takasbank&apos;ın işlettiği TEFAS&apos;ta yayımlanan günlük birim pay fiyatlarıdır ve sisteme genellikle aynı akşam alınır. Gram altın fiyatı serbest piyasa satış fiyatıdır; bu kaynağa ulaşılamadığında ons altın fiyatı ve USD/TRY kurundan hesaplanır. Döviz kurları gösterge niteliğindedir ve bankanızın alış-satış fiyatlarından farklı olabilir.
                </p>
            </LegalSection>

            <LegalSection title="Sorumluluğun sınırlandırılması">
                <p className={legalTextClass}>
                    Yarmak geliştiricileri ve yöneticileri; platformdaki bilgilerin eksik, hatalı veya gecikmeli olması, sunucu kesintileri veya sistem hataları sebebiyle kullanıcıların ya da üçüncü şahısların uğrayabileceği doğrudan ya da dolaylı maddi ve manevi zararlardan, kâr kayıplarından veya yatırım kararlarından hiçbir suretle hukuki veya cezai olarak sorumlu tutulamaz.
                </p>
            </LegalSection>
        </LegalDocument>
    );
}
