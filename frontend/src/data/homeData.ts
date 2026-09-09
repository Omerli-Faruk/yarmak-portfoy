import { Globe, LineChart, Clock, Activity, Bell, Shield } from 'lucide-react';

export const featureCards = [
    { icon: Globe, title: 'Hisse, Fon ve Altın Tek Yerde', desc: 'BIST hisseleri, TEFAS yatırım fonları ve gram altını tek bir panelden takip edin. Farklı banka ve aracı kurum uygulamaları arasında kaybolmaya son.' },
    { icon: LineChart, title: 'Gerçek Zamanlı Dolar Bazlı Getiri', desc: 'Portföyünüzün TL performansı yanıltıcı olabilir. USD/TRY kuru ile anlık çevrim yaparak enflasyondan arındırılmış gerçek satın alma gücünüzü görün.' },
    { icon: Clock, title: 'Bedelsiz & Temettü Otomasyonu', desc: 'Sermaye artırımı sonrası lot sayınız ve birim maliyetiniz matematiksel olarak düzeltilir. Temettü ödemeleriniz brüt/net ayrımıyla kayıt altında tutulur.' },
    { icon: Activity, title: 'Hassas AOF Maliyet Hesabı', desc: 'Ağırlıklı ortalama fiyat (AOF) formülüyle her kademeli alım-satım ve komisyon gideri maliyetinize kuruşu kuruşuna doğru yansıtılır.' },
    { icon: Bell, title: 'Akıllı Fiyat Alarmları', desc: 'Hedef fiyat veya zarar-kes (stop-loss) seviyeleri belirleyin. Piyasa belirlediğiniz noktaya ulaştığında anında bildirim alın.' },
    { icon: Shield, title: 'Banka Şifresi ve Yetki İstemiyoruz', desc: 'Hiçbir finansal hesabınıza erişim veya şifre talep etmiyoruz. Sadece işlemlerinizi kaydedin, tüm profesyonel analitiği biz hesaplayalım.' },
];

export const faqItems = [
    { question: 'Yarmak tam olarak ne yapıyor?', answer: 'Yarmak, bireysel yatırımcıların BIST hisseleri, TEFAS fonları ve altın pozisyonlarını tek bir panelde izlemesini sağlayan modern bir portföy takip terminalidir. Alım-satım, temettü ve bedelsiz bölünme işlemlerinizi girdiğinizde toplam kâr/zarar, maliyet ve getiri oranlarınızı otomatik hesaplar.' },
    { question: 'Piyasa fiyatları ne sıklıkla güncelleniyor?', answer: 'Arka planda çalışan entegre veri tarayıcımız (Scraper Worker), Borsa İstanbul hisseleri, altın ve kurları periyodik aralıklarla veritabanında günceller. TEFAS fon fiyatları ise her iş günü resmi takas kaynaklarından çekilerek portföyünüze yansıtılır.' },
    { question: 'Finansal verilerim güvende mi?', answer: 'Kesinlikle evet. Banka, MKK veya aracı kurum şifreleriniz asla talep edilmez. Tüm veri trafiği endüstri standardı şifreleme protokolleriyle (HTTPS/TLS) korunur ve yalnızca sizin sisteme girdiğiniz lot/işlem kayıtları saklanır.' },
    { question: 'Dolar bazlı portföy değeri nasıl hesaplanıyor?', answer: 'Portföyünüzdeki her bir varlığın toplam TL değeri anlık USD/TRY kuru ile bölünerek dinamik olarak dolara çevrilir. Bu sayede kur hareketlerinin portföyünüze gerçek etkisini anlık grafiklerle izleyebilirsiniz.' },
    { question: 'Bedelsiz bölünmeler portföyüme nasıl yansır?', answer: 'Şirketlerin bedelsiz sermaye artırımı gerçekleştiğinde sistem bunu otomatik olarak algılar; lot miktarınızı oran kadar artırırken hisse başı ortalama maliyetinizi aynı oranda düşürür. Toplam yatırım maliyetiniz bozulmaz.' },
    { question: 'Yarmak ücretli mi olacak?', answer: 'Hayır, Yarmak bireysel yatırımcılar için temel ve profesyonel portföy takip özellikleriyle tamamen ücretsiz olarak sunulmaktadır. Amacımız Türkiye sermaye piyasalarında kaliteli bir yatırım deneyimi oluşturmaktır.' },
];

export const popularTags = [
    { label: 'Aselsan', query: 'ASELS' },
    { label: 'Tüpraş', query: 'TUPRS' },
    { label: 'Türk Hava Yolları', query: 'THYAO' },
    { label: 'Altın', query: 'ALTIN' },
    { label: 'BIST 100', query: 'XU100' },
];

export const SLIDER_CONFIG = [
    { symbol: 'USDTRY', label: 'Dolar', type: 'flag_us' },
    { symbol: 'EURTRY', label: 'Euro', type: 'flag_eu' },
    { symbol: 'XU100', label: 'BIST 100', type: 'text' },
    { symbol: 'XU030', label: 'BIST 30', type: 'text' },
    { symbol: 'ALTIN', label: 'Gram Altın', type: 'gold' },
    { symbol: 'KCHOL', label: 'Koç Holding', type: 'stock' },
    { symbol: 'SASA', label: 'SASA', type: 'stock' },
    { symbol: 'THYAO', label: 'THYAO', type: 'stock' },
    { symbol: 'ASELS', label: 'Aselsan', type: 'stock' },
    { symbol: 'TUPRS', label: 'Tüpraş', type: 'stock' },
    { symbol: 'ASTOR', label: 'ASTOR', type: 'stock' },
];
