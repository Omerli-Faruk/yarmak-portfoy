package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/handlers"
	"yarmak/internal/services"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type seedAsset struct {
	Symbol    string
	Name      string
	AssetType string
}

func main() {
	// -demo: yalnızca yerel deneme için demo hesabı ve örnek portföy oluşturur (varlık listesini yüklemez).
	demo := flag.Bool("demo", false, "demo kullanıcısını (demo / demo12345) ve örnek portföyü oluştur")
	flag.Parse()
	_ = godotenv.Load(".env")
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		log.Fatal("DB_URL bulunamadı")
	}

	conn, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Veritabanı bağlantı hatası: %v", err)
	}
	defer conn.Close()

	queries := database.New(conn)
	servicesPkg := services.NewServices(queries, conn)
	cfg := &handlers.ApiConfig{DB: queries, DBConn: conn, Services: servicesPkg}
	ctx := context.Background()

	if *demo {
		fmt.Println("=== Demo hesabı hazırlanıyor ===")
		if err := seedDemo(ctx, queries, servicesPkg); err != nil {
			log.Fatalf("Demo verisi yüklenemedi: %v", err)
		}
		return
	}

	// 📊 BIST 100 (TAM 100 HİSSE) + TEFAS TOP 30 (TAM 30 FON)
	assets := []seedAsset{
		// --- 📈 FONLAR ---
		{"TTA", "İş Portföy Altın Fonu", "FON"},
		{"MAC", "Marmara Capital Portföy Hisse Senedi Fonu", "FON"},
		{"TCD", "Tacirler Portföy Değişken Fon", "FON"},
		{"NNF", "Hedef Portföy Birinci Hisse Senedi Fonu", "FON"},
		{"AFT", "Ak Portföy Yeni Teknolojiler Yabancı Hisse Fonu", "FON"},
		{"YAY", "Yapı Kredi Portföy Yabancı Teknoloji Hisse Senedi Fonu", "FON"},
		{"IIH", "İstanbul Portföy Üçüncü Hisse Senedi Fonu", "FON"},
		{"TKF", "Tacirler Portföy Hisse Senedi Fonu", "FON"},
		{"IJC", "İş Portföy Yarı İletken Teknolojileri Değişken Fon", "FON"},
		{"IPB", "İstanbul Portföy Birinci Değişken Fon", "FON"},
		{"RIK", "Re-Pie Portföy İkinci Değişken Fon", "FON"},
		{"KUB", "Kuveyt Türk Portföy Birinci Katılım Fonu", "FON"},
		{"CPU", "Aktif Portföy Teknoloji Katılım Fonu", "FON"},
		{"TMG", "İş Portföy Yabancı Hisse Senedi Fonu", "FON"},
		{"GMR", "Garanti Portföy İkinci Hisse Senedi Fonu", "FON"},
		{"HVK", "Hedef Portföy Katılım Hisse Senedi Fonu", "FON"},
		{"TI2", "İş Portföy Hisse Senedi (TL) Fonu", "FON"},
		{"IJZ", "İş Portföy Siber Güvenlik Teknolojileri Değişken Fon", "FON"},
		{"KPH", "İş Portföy Kar Payı Ödeyen Hisse Senedi Fonu", "FON"},
		{"AFA", "Ak Portföy Amerika Yabancı Hisse Senedi Fonu", "FON"},
		{"OGD", "OYAK Portföy Birinci Değişken Fon", "FON"},
		{"ZPE", "Ziraat Portföy Katılım Endeksi Fonu", "FON"},
		{"KZL", "QNB Portföy Altın Fonu", "FON"},
		{"ITP", "İş Portföy Teknoloji Karma Fon", "FON"},
		{"ALC", "Ak Portföy Alternatif Enerji Yabancı Hisse Fonu", "FON"},
		{"FDP", "Fiba Portföy Değişken Fon", "FON"},
		{"GVG", "Garanti Portföy Yabancı Teknoloji Fonu", "FON"},
		{"ST1", "Strateji Portföy Birinci Hisse Senedi Fonu", "FON"},
		{"DVT", "Deniz Portföy Metaverse ve Dijital Yaşam Tek. Değişken Fon", "FON"},
		{"YHK", "Yapı Kredi Portföy Çoklu Varlık Birinci Değişken Fon", "FON"},

		// --- 🏛️ HİSSELER ---
		{"AEFES", "Anadolu Efes Biracılık ve Malt Sanayii A.Ş.", "HISSE"},
		{"AGHOL", "AG Anadolu Grubu Holding A.Ş.", "HISSE"},
		{"AHGAZ", "Ahlatcı Doğal Gaz Dağıtım Enerji ve Yatırım A.Ş.", "HISSE"},
		{"AKBNK", "Akbank T.A.Ş.", "HISSE"},
		{"AKCNS", "Akçansa Çimento Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"AKFGY", "Akfen Gayrimenkul Yatırım Ortaklığı A.Ş.", "HISSE"},
		{"AKSA", "Aksa Akrilik Kimya Sanayii A.Ş.", "HISSE"},
		{"AKSEN", "Aksa Enerji Üretim A.Ş.", "HISSE"},
		{"ALARK", "Alarko Holding A.Ş.", "HISSE"},
		{"ALBRK", "Albaraka Türk Katılım Bankası A.Ş.", "HISSE"},
		{"ALFAS", "Alfa Solar Enerji Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"ANHYT", "Anadolu Hayat Emeklilik A.Ş.", "HISSE"},
		{"ARCLK", "Arçelik A.Ş. (Beko)", "HISSE"},
		{"ASELS", "Aselsan Elektronik Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"ASTOR", "Astor Enerji A.Ş.", "HISSE"},
		{"BERA", "Bera Holding A.Ş.", "HISSE"},
		{"BIENY", "Bien Yapı Ürünleri Sanayi Turizm ve Ticaret A.Ş.", "HISSE"},
		{"BIMAS", "BİM Birleşik Mağazalar A.Ş.", "HISSE"},
		{"BIOEN", "Biotrend Çevre ve Enerji Yatırımları A.Ş.", "HISSE"},
		{"BOBET", "Boğaziçi Beton Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"BRSAN", "Borusan Mannesmann Boru Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"BRYAT", "Borusan Yatırım ve Pazarlama A.Ş.", "HISSE"},
		{"BUCIM", "Bursa Çimento Fabrikası A.Ş.", "HISSE"},
		{"CANTE", "Çan2 Termik A.Ş.", "HISSE"},
		{"CCOLA", "Coca-Cola İçecek A.Ş.", "HISSE"},
		{"CIMSA", "Çimsa Çimento Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"CWENE", "CW Enerji Mühendislik Ticaret ve Sanayi A.Ş.", "HISSE"},
		{"DOAS", "Doğuş Otomotiv Servis ve Ticaret A.Ş.", "HISSE"},
		{"DOHOL", "Doğan Şirketler Grubu Holding A.Ş.", "HISSE"},
		{"ECILC", "EİS Eczacıbaşı İlaç, Sınai ve Finansal Yatırımlar", "HISSE"},
		{"EGEEN", "Ege Endüstri ve Ticaret A.Ş.", "HISSE"},
		{"EKGYO", "Emlak Konut Gayrimenkul Yatırım Ortaklığı A.Ş.", "HISSE"},
		{"ENJSA", "Enerjisa Enerji A.Ş.", "HISSE"},
		{"ENKAI", "Enka İnşaat ve Sanayi A.Ş.", "HISSE"},
		{"EREGL", "Ereğli Demir ve Çelik Fabrikaları T.A.Ş.", "HISSE"},
		{"EUPWR", "Europower Enerji ve Otomasyon Teknolojileri A.Ş.", "HISSE"},
		{"EUREN", "Europen Endüstri İnşaat Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"FROTO", "Ford Otomotiv Sanayi A.Ş.", "HISSE"},
		{"GARAN", "Türkiye Garanti Bankası A.Ş.", "HISSE"},
		{"GENIL", "Gen İlaç ve Sağlık Ürünleri Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"GESAN", "Girişim Elektrik Sanayi Taahhüt ve Ticaret A.Ş.", "HISSE"},
		{"GUBRF", "Gübre Fabrikaları T.A.Ş.", "HISSE"},
		{"GWIND", "Galata Wind Enerji A.Ş.", "HISSE"},
		{"HALKB", "Türkiye Halk Bankası A.Ş.", "HISSE"},
		{"HEKTS", "Hektaş Ticaret T.A.Ş.", "HISSE"},
		{"TRENJ", "TR Doğal Enerji Kaynakları A.Ş.", "HISSE"},
		{"ISCTR", "Türkiye İş Bankası A.Ş. (C Grubu)", "HISSE"},
		{"ISDMR", "İskenderun Demir ve Çelik A.Ş.", "HISSE"},
		{"ISGYO", "İş Gayrimenkul Yatırım Ortaklığı A.Ş.", "HISSE"},
		{"ISMEN", "İş Yatırım Menkul Değerler A.Ş.", "HISSE"},
		{"IZENR", "İzdemir Enerji Elektrik Üretim A.Ş.", "HISSE"},
		{"KARSN", "Karsan Otomotiv Sanayii ve Ticaret A.Ş.", "HISSE"},
		{"KCAER", "Kocaer Çelik Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"KCHOL", "Koç Holding A.Ş.", "HISSE"},
		{"KLSER", "Kaleseramik Çanakkale Kalebodur Seramik San. A.Ş.", "HISSE"},
		{"KMPUR", "Kimteks Poliüretan Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"KONTR", "Kontrolmatik Teknoloji Enerji ve Mühendislik A.Ş.", "HISSE"},
		{"KONYA", "Konya Çimento Sanayii A.Ş.", "HISSE"},
		{"KORDS", "Kordsa Teknik Tekstil A.Ş.", "HISSE"},
		{"TRMET", "TR Anadolu Metal Madencilik A.Ş.", "HISSE"},
		{"TRALT", "Türk Altın İşletmeleri A.Ş.", "HISSE"},
		{"KRDMD", "Kardemir Karabük Demir Çelik San. ve Tic. A.Ş. (D)", "HISSE"},
		{"MAVI", "Mavi Giyim Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"MGROS", "Migros Ticaret A.Ş.", "HISSE"},
		{"MIATK", "MİA Teknoloji A.Ş.", "HISSE"},
		{"ODAS", "Odaş Elektrik Üretim Sanayi Ticaret A.Ş.", "HISSE"},
		{"OTKAR", "Otokar Otomotiv ve Savunma Sanayi A.Ş.", "HISSE"},
		{"OYAKC", "Oyak Çimento Fabrikaları A.Ş.", "HISSE"},
		{"PETKM", "Petkim Petrokimya Holding A.Ş.", "HISSE"},
		{"PGSUS", "Pegasus Hava Taşımacılığı A.Ş.", "HISSE"},
		{"QUAGR", "Qua Granite Hayal Yapı ve Ürünleri A.Ş.", "HISSE"},
		{"REEDR", "Reeder Teknoloji Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"SAHOL", "Hacı Ömer Sabancı Holding A.Ş.", "HISSE"},
		{"SASA", "Sasa Polyester Sanayi A.Ş.", "HISSE"},
		{"SDTTR", "SDT Uzay ve Savunma Teknolojileri A.Ş.", "HISSE"},
		{"SISE", "Türkiye Şişe ve Cam Fabrikaları A.Ş.", "HISSE"},
		{"SKBNK", "Şekerbank T.A.Ş.", "HISSE"},
		{"SMRTG", "Smart Güneş Enerjisi Teknolojileri A.Ş.", "HISSE"},
		{"SOKM", "Şok Marketler Ticaret A.Ş.", "HISSE"},
		{"TABGD", "TAB Gıda Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"TAVHL", "TAV Havalimanları Holding A.Ş.", "HISSE"},
		{"TCELL", "Turkcell İletişim Hizmetleri A.Ş.", "HISSE"},
		{"THYAO", "Türk Hava Yolları A.O.", "HISSE"},
		{"TKFEN", "Tekfen Holding A.Ş.", "HISSE"},
		{"TOASO", "Tofaş Türk Otomobil Fabrikası A.Ş.", "HISSE"},
		{"TSKB", "Türkiye Sınai Kalkınma Bankası A.Ş.", "HISSE"},
		{"TTKOM", "Türk Telekomünikasyon A.Ş.", "HISSE"},
		{"TTRAK", "Türk Traktör ve Ziraat Makineleri A.Ş.", "HISSE"},
		{"TUKAS", "Tukaş Gıda Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"TUPRS", "Türkiye Petrol Rafinerileri A.Ş.", "HISSE"},
		{"ULKER", "Ülker Bisküvi Sanayi A.Ş.", "HISSE"},
		{"VAKBN", "Türkiye Vakıflar Bankası T.A.O.", "HISSE"},
		{"VAKKO", "Vakko Tekstil ve Hazır Giyim Sanayi İşletmeleri A.Ş.", "HISSE"},
		{"VESBE", "Vestel Beyaz Eşya Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"VESTL", "Vestel Elektronik Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"YKBNK", "Yapı ve Kredi Bankası A.Ş.", "HISSE"},
		{"YYLGD", "Yayla Agro Gıda Sanayi ve Ticaret A.Ş.", "HISSE"},
		{"ZOREN", "Zorlu Enerji Elektrik Üretim A.Ş.", "HISSE"},
		{"TATEN", "Tatlıpınar Enerji Üretim A.Ş.", "HISSE"},
		{"YEOTK", "YEO Teknoloji Enerji ve Endüstri A.Ş.", "HISSE"},
	}

	fmt.Println("=== 🚀 BIST 100 & TOP 30 TEFAS TOHUMLAMA BAŞLATILDI ===")
	fmt.Printf("Toplam %d adet varlık işlenecek...\n\n", len(assets))

	successCount := 0
	for i, item := range assets {
		// Varlık veritabanında yoksa oluşturur, varsa fiyatını günceller
		asset, err := cfg.Services.Asset.GetOrCreateAssetBySymbol(ctx, item.Symbol, item.AssetType)
		if err != nil {
			fmt.Printf("[%d/%d] ❌ %-8s Hata: %v\n", i+1, len(assets), item.Symbol, err)
			continue
		}

		// Şirket/Fon ismini günceller
		_, _ = conn.ExecContext(ctx, "UPDATE assets SET name = $1 WHERE id = $2", item.Name, asset.ID)

		fmt.Printf("[%d/%d] ✅ %-8s | %-52s | %s TL\n",
			i+1, len(assets), asset.Symbol, item.Name, asset.CurrentPrice)
		successCount++

		// Rate-limit yememek için ufak bekleme
		time.Sleep(100 * time.Millisecond)
	}

	fmt.Printf("\n🎉 Tohumlama tamamlandı! (%d/%d varlık başarıyla yüklendi)\n", successCount, len(assets))
}
