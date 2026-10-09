import { Globe, LineChart, Clock, Activity, Bell, Shield } from 'lucide-react';

// /api/assets yanıtındaki bir varlık (fiyat ve değişim metin olarak gelir: "318.50", "+1.25")
export interface CatalogAsset {
    id: number;
    symbol: string;
    name: string;
    asset_type: string;
    current_price: string;
    change: string;
    positive: boolean;
}

export const featureCards = [
    { icon: Globe, title: 'Hisse, fon ve altın tek yerde', desc: 'BIST hisseleri, TEFAS yatırım fonları, gram altın ve döviz yatırımlarınızı tek bir panelden takip edin. Farklı aracı kurumlardaki işlemlerinizi tek listede toplayabilirsiniz.' },
    { icon: LineChart, title: 'Dolar karşılığı', desc: 'Portföy değerinizi ve kâr/zararınızı güncel USD/TRY kuruyla dolar cinsinden de görüntüleyebilirsiniz. Çevrim, alış tarihindeki kurla değil güncel kurla yapılır.' },
    { icon: Clock, title: 'Bedelsiz ve temettü takibi', desc: 'Bedelsiz sermaye artırımı veya bölünme yönetici tarafından sisteme tanımlandığında lot sayınız ve birim maliyetiniz orana göre düzeltilir. Hesabınıza geçen net temettüleri kendiniz kaydederek toplam getirinize dahil edebilirsiniz.' },
    { icon: Activity, title: 'Ortalama maliyet (AOF) hesabı', desc: 'Her alımınız ve alış komisyonunuz ağırlıklı ortalama fiyat yöntemiyle birim maliyetinize eklenir. Satışta ödediğiniz komisyon ise gerçekleşen kârınızdan düşülür.' },
    { icon: Bell, title: 'Fiyat alarmları', desc: 'Hisse, fon, altın veya döviz için hedef fiyat belirleyin. Fiyat hedefe ulaştığında alarm site içindeki bildirim zilinde görünür; e-posta veya telefon bildirimi gönderilmez. Fiyatlar seans saatlerinde gecikmeli verilerle yaklaşık 5 dakikada bir, fonlarda ise günlük fiyat alındığında kontrol edilir.' },
    { icon: Shield, title: 'Banka şifresi ve yetki istemiyoruz', desc: 'Hiçbir banka veya aracı kurum hesabınıza bağlanmıyor, şifre istemiyoruz. İşlemlerinizi siz girersiniz, hesaplamaları Yarmak yapar.' },
];

export const faqItems = [
    { question: 'Yarmak tam olarak ne yapıyor?', answer: 'Yarmak; BIST hisselerini, TEFAS fonlarını, altını ve dövizi tek ekranda takip etmenizi sağlayan bir portföy takip uygulamasıdır. Alım-satım ve temettü kayıtlarınızı girdiğinizde toplam kâr/zarar, ortalama maliyet ve getiri oranlarınız otomatik hesaplanır.' },
    { question: 'Piyasa fiyatları ne sıklıkla güncelleniyor?', answer: "BIST hisse fiyatları, altın ve döviz kurları iş günlerinde 10:00–18:15 arasında yaklaşık 5 dakikada bir güncellenir. Borsa İstanbul verileri en az 15 dakika gecikmelidir. Fon fiyatları ise TEFAS'ta yayımlandıktan sonra iş günü akşamları sisteme alınır; bu nedenle fonlarda gün içi fiyat değişimi görünmez." },
    { question: 'Finansal verilerim güvende mi?', answer: 'Banka, MKK veya aracı kurum şifrenizi hiçbir zaman istemiyoruz. Hesabınız için e-posta adresiniz, kullanıcı adınız ve şifrenizin geri çözülemeyen bir özeti (bcrypt) saklanır; oturum anahtarlarınızın da yalnızca özeti tutulur. Bunların dışında girdiğiniz işlemler, temettüler, fiyat alarmları ve bunlardan hesaplanan günlük portföy değeri saklanır.' },
    { question: 'Dolar bazlı portföy değeri nasıl hesaplanıyor?', answer: 'Portföyünüzün TL değeri, sistemdeki güncel USD/TRY kuruna bölünerek dolara çevrilir. Grafikteki geçmiş değerler de bugünkü kurla çevrildiği için bu görünüm kur değişiminin geçmişteki etkisini göstermez; yalnızca portföyünüzün bugünkü kurla dolar karşılığını gösterir.' },
    { question: 'Bedelsiz bölünmeler portföyüme nasıl yansır?', answer: 'Bir hissede bedelsiz sermaye artırımı veya bölünme olduğunda bölünme oranı yönetici tarafından sisteme girilir. Bölünme tarihine kadarki işlemlerinizde lot sayınız oran kadar artırılır, birim maliyetiniz aynı oranda düşürülür; toplam maliyetiniz değişmez.' },
    { question: 'Yarmak ücretli mi?', answer: 'Hayır, Yarmak şu anda tamamen ücretsizdir.' },
];

export const popularTags = [
    { label: 'Aselsan', query: 'ASELS' },
    { label: 'Tüpraş', query: 'TUPRS' },
    { label: 'Türk Hava Yolları', query: 'THYAO' },
    { label: 'Altın', query: 'ALTIN' },
    { label: 'BIST 100', query: 'XU100' },
];

// Kayan şeritte gösterilen varlıklar, bu sırayla. 'index' türü endeks puanıdır, ₺ ile yazılmaz.
export type TickerType = 'flag_us' | 'flag_eu' | 'index' | 'gold' | 'tefas' | 'stock';

export const SLIDER_CONFIG: { symbol: string; label: string; type: TickerType }[] = [
    { symbol: 'USDTRY', label: 'Dolar', type: 'flag_us' },
    { symbol: 'EURTRY', label: 'Euro', type: 'flag_eu' },
    { symbol: 'XU100', label: 'BIST 100', type: 'index' },
    { symbol: 'XU030', label: 'BIST 30', type: 'index' },
    { symbol: 'ALTIN', label: 'Gram Altın', type: 'gold' },
    { symbol: 'KCHOL', label: 'Koç Holding', type: 'stock' },
    { symbol: 'SASA', label: 'SASA', type: 'stock' },
    { symbol: 'THYAO', label: 'THYAO', type: 'stock' },
    { symbol: 'ASELS', label: 'Aselsan', type: 'stock' },
    { symbol: 'TUPRS', label: 'Tüpraş', type: 'stock' },
    { symbol: 'ASTOR', label: 'ASTOR', type: 'stock' },
];
