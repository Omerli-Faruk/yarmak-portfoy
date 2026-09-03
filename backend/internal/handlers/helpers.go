package handlers

import (
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func HandlerReadiness(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

func respondWithJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	dat, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"Sunucu hatası oluştu"}`))
		return
	}
	w.WriteHeader(code)
	_, _ = w.Write(dat)
}

func respondWithError(w http.ResponseWriter, code int, msg string, err error) {
	if code > 499 {
		slog.Error(msg, "err", err)
	} else {
		slog.Warn(msg, "err", err)
	}
	respondWithJSON(w, code, map[string]string{"error": msg})
}

func (cfg *ApiConfig) GetOrCreateAssetBySymbol(ctx context.Context, symbol string, assetType string) (database.Asset, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	assetType = strings.ToUpper(strings.TrimSpace(assetType))
	asset, err := cfg.DB.GetAssetBySymbol(ctx, symbol)
	if err == nil {
		return asset, nil
	}
	var livePrice float64
	var fetchErr error
	if assetType == "HISSE" || assetType == "ALTIN" || assetType == "DOVIZ" {
		livePrice, fetchErr = scraper.FetchBISTPrice(symbol)
	} else if assetType == "FON" {
		livePrice, fetchErr = scraper.FetchTEFASPrice(symbol)
	} else {
		return database.Asset{}, fmt.Errorf("varlık piyasada bulunamadı: %s", symbol)
	}
	if fetchErr != nil {
		return database.Asset{}, fmt.Errorf("varlık fiyatı çekilemedi (%s): %w", symbol, fetchErr)
	}
	if livePrice <= 0 {
		return database.Asset{}, fmt.Errorf("varlık fiyatı 0 veya negatif (%s)", symbol)
	}
	priceStr := fmt.Sprintf("%.6f", livePrice)
	newAsset, err := cfg.DB.CreateAsset(ctx, database.CreateAssetParams{
		Symbol:       symbol,
		Name:         symbol,
		AssetType:    assetType,
		CurrentPrice: priceStr,
	})
	if err != nil {
		assetBySymbol, err := cfg.DB.GetAssetBySymbol(ctx, symbol)
		if err != nil {
			return database.Asset{}, fmt.Errorf("varlık veritabanına kaydedilemedi (%s): %w", symbol, err)
		}
		return assetBySymbol, nil
	}
	_, _ = cfg.DB.CreatePriceHistory(ctx, database.CreatePriceHistoryParams{
		AssetID:    newAsset.ID,
		Price:      priceStr,
		RecordedAt: time.Now().UTC(),
	})
	return newAsset, nil
}

func getUserHoldingLot(holdings []database.GetUserHoldingsSummaryRow, assetID int64) float64 {
	for _, h := range holdings {
		if h.AssetID == assetID {
			lot, _ := strconv.ParseFloat(h.TotalAmount, 64)
			return lot
		}
	}
	return 0
}
