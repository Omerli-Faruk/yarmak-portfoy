package services

import "yarmak/internal/scraper"

// PriceSource, servislerin dış piyasalardan aldığı fiyat verisi. Testlerde ağa çıkmadan sahte kaynak verilebilsin diye arayüz.
type PriceSource interface {
	// History, sembolün verilen aralık ve sıklıktaki geçmişi. Gram altın sembolleri ons × dolar kurundan türetilir.
	History(symbol, rng, interval string) ([]scraper.StockHistoricalRecord, error)
	// Price, hisse, döviz ve altın türevlerinin (çeyrek, yarım vb.) güncel fiyatı.
	Price(symbol string) (float64, error)
	// FundPrice, TEFAS fonunun güncel fiyatı.
	FundPrice(symbol string) (float64, error)
}

// scraperPriceSource, varsayılan kaynak: scraper paketine yönlendirir.
type scraperPriceSource struct{}

// NewScraperPriceSource, Yahoo/Bigpara/TEFAS'tan veri çeken varsayılan kaynağı döner.
func NewScraperPriceSource() PriceSource { return scraperPriceSource{} }

func (scraperPriceSource) History(symbol, rng, interval string) ([]scraper.StockHistoricalRecord, error) {
	_, hist, err := scraper.FetchBISTHistoryInterval(symbol, rng, interval)
	return hist, err
}

func (scraperPriceSource) Price(symbol string) (float64, error) {
	return scraper.FetchBISTPrice(symbol)
}

func (scraperPriceSource) FundPrice(symbol string) (float64, error) {
	return scraper.FetchTEFASPrice(symbol)
}
