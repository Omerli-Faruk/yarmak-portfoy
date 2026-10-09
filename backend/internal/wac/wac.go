// Package wac, ağırlıklı ortalama maliyet (WAC) hesabını tek yerde tutar.
// services ve scraper paketleri birbirini import edemediği için ortak hesap burada duruyor.
package wac

import (
	"strconv"
	"yarmak/internal/database"
)

// HoldingAndCost, işlemleri sırayla gezerek eldeki lotu ve ağırlıklı ortalama maliyeti hesaplar.
// Alışlarda komisyon maliyete eklenir; lot sıfıra inerse maliyet de sıfırlanır.
func HoldingAndCost(transactions []database.Transaction) (currentLot float64, avgCost float64) {
	runningLot := 0.0
	runningCost := 0.0
	for _, tx := range transactions {
		amount, _ := strconv.ParseFloat(tx.Amount, 64)
		price, _ := strconv.ParseFloat(tx.Price, 64)
		commission, _ := strconv.ParseFloat(tx.Commission, 64)
		if tx.Type == "BUY" {
			total := (amount * price) + commission
			// Sıfıra bölme koruması: bozuk veri gelirse NaN yayılmasını engelle
			if (runningLot + amount) > 0 {
				runningCost = (runningLot*runningCost + total) / (runningLot + amount)
			}
			runningLot = runningLot + amount
		} else if tx.Type == "SELL" {
			runningLot = runningLot - amount
			if runningLot <= 0.000001 {
				runningLot = 0
				runningCost = 0
			}
		}
	}
	return runningLot, runningCost
}
