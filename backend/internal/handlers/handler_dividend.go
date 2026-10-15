package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
	"yarmak/internal/database"

	"github.com/go-chi/chi/v5"
)

// Bireysel yatırımcıya ödenen kâr payında stopaj 22.12.2024'ten beri %15 (9286 sayılı Cumhurbaşkanı Kararı).
// Şirkete göre etkin oran farklı olabildiği için istekte tax_rate gelirse o kullanılır.
const defaultDividendTaxRate = 0.15

// parseTaxRate, "0.15" ya da "15" biçiminde gelen oranı 0-1 aralığına çevirir. Geçersizse false döner.
func parseTaxRate(raw string) (float64, bool) {
	tr, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, false
	}
	if tr > 1 {
		tr = tr / 100
	}
	if tr >= 0 && tr < 1 {
		return tr, true
	}
	return 0, false
}

// storedTaxRate, kayıttaki brüt ve stopaj tutarından oranı geri hesaplar.
func storedTaxRate(d database.Dividend) float64 {
	gross, _ := strconv.ParseFloat(d.GrossAmount, 64)
	tax, _ := strconv.ParseFloat(d.TaxAmount, 64)
	if gross > 0 {
		if rate := tax / gross; rate >= 0 && rate < 1 {
			return rate
		}
	}
	return defaultDividendTaxRate
}

// splitDividend, tutarı brüt, stopaj ve net olarak ayırır. isNet true ise tutar hesaba geçen net tutardır.
func splitDividend(amount, taxRate float64, isNet bool) (gross, tax, net float64) {
	if isNet {
		net = amount
		if taxRate > 0 && taxRate < 1 {
			gross = net / (1.0 - taxRate)
			tax = gross - net
		} else {
			gross = net
		}
		return gross, tax, net
	}
	gross = amount
	tax = gross * taxRate
	net = gross - tax
	return gross, tax, net
}

// amountFromPerShare, hisse başı temettüyü ödeme tarihindeki lot sayısıyla çarpıp params.Amount'a yazar.
// Sorun olursa hata yanıtını kendisi yazar ve false döner.
func (cfg *ApiConfig) amountFromPerShare(w http.ResponseWriter, r *http.Request, userID int64, params *createDividendRequest) bool {
	userTxs, err := cfg.DB.GetUserTransactionsForAsset(r.Context(), database.GetUserTransactionsForAssetParams{
		UserID:  userID,
		AssetID: params.AssetID,
	})
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "İşlem geçmişi alınamadı", err)
		return false
	}

	var historicalLot float64
	for _, tx := range userTxs {
		if !tx.TransactionDate.After(params.PaymentDate) {
			amt, _ := strconv.ParseFloat(tx.Amount, 64)
			if tx.Type == "BUY" {
				historicalLot += amt
			} else if tx.Type == "SELL" {
				historicalLot -= amt
			}
		}
	}

	if historicalLot <= 0 {
		respondWithError(w, http.StatusBadRequest, "Temettü tarihinde portföyünüzde bu hisseye ait lot bulunamadı", nil)
		return false
	}

	perShare, err := strconv.ParseFloat(params.AmountPerShare, 64)
	if err != nil || perShare <= 0 {
		respondWithError(w, http.StatusBadRequest, "Geçersiz hisse başı temettü miktarı", err)
		return false
	}

	params.Amount = fmt.Sprintf("%.6f", historicalLot*perShare)
	return true
}

// HandlerCreateDividend, kullanıcının portföyüne temettü geliri kaydeder.
// Hisse başına tutar (amount_per_share) verilirse ödeme tarihindeki lot sayısıyla çarpılır.
// Brüt, stopaj ve net tutarı hesaplar; tax_rate gelmezse %15 kullanılır.
// @Summary Temettü Geliri Kaydet
// @Description Kullanıcının aldığı nakit temettü ödemesini kaydeder
// @Tags Dividends
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createDividendRequest true "Temettü Bilgileri"
// @Success 201 {object} database.Dividend
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /dividends [post]
func (cfg *ApiConfig) HandlerCreateDividend(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	params := createDividendRequest{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	if params.PaymentDate.IsZero() {
		params.PaymentDate = time.Now().UTC()
	}

	if params.AmountPerShare != "" && !cfg.amountFromPerShare(w, r, userID, &params) {
		return
	}
	amount, _ := strconv.ParseFloat(params.Amount, 64)
	if amount <= 0 || params.AssetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Miktar veya Asset ID geçersiz", nil)
		return
	}

	taxRate := defaultDividendTaxRate
	if params.TaxRate != "" {
		if tr, ok := parseTaxRate(params.TaxRate); ok {
			taxRate = tr
		}
	}

	grossAmount, taxAmount, netAmount := splitDividend(amount, taxRate, params.IsNet)
	cleanGross := fmt.Sprintf("%.6f", grossAmount)
	cleanTax := fmt.Sprintf("%.6f", taxAmount)
	cleanNet := fmt.Sprintf("%.6f", netAmount)

	userDividend, err := cfg.DB.CreateDividend(r.Context(), database.CreateDividendParams{
		UserID:      userID,
		AssetID:     params.AssetID,
		Amount:      cleanGross,
		PaymentDate: params.PaymentDate,
		GrossAmount: cleanGross,
		TaxAmount:   cleanTax,
		NetAmount:   cleanNet,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Temettü oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, userDividend)
}

// HandlerGetUserDividends, kullanıcının tüm temettü gelir kayıtlarını tarih sırasıyla döner.
// @Summary Kullanıcının Temettü Geçmişi
// @Description Kullanıcının aldığı tüm temettü ödemelerini listeler
// @Tags Dividends
// @Security BearerAuth
// @Produce json
// @Success 200 {array} database.Dividend
// @Failure 401 {object} map[string]string
// @Router /dividends [get]
func (cfg *ApiConfig) HandlerGetUserDividends(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	dividends, err := cfg.DB.GetUserDividends(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Temettü bulunamadı", err)
		return
	}
	if dividends == nil {
		dividends = []database.GetUserDividendsRow{}
	}
	respondWithJSON(w, http.StatusOK, dividends)
}

// HandlerUpdateDividend, mevcut bir temettü kaydını günceller.
// tax_rate gönderilmezse kaydın mevcut stopaj oranı korunur.
// @Summary Temettü Kaydını Güncelle
// @Description Kullanıcının kaydettiği bir temettü gelirini günceller
// @Tags Dividends
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Temettü ID"
// @Param dividend body createDividendRequest true "Güncellenecek Temettü Bilgileri"
// @Success 200 {object} database.Dividend
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /dividends/{id} [put]
func (cfg *ApiConfig) HandlerUpdateDividend(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	dividendID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz temettü ID", err)
		return
	}

	decoder := json.NewDecoder(r.Body)
	params := createDividendRequest{}
	err = decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "İstek gövdesi çözümlenemedi", err)
		return
	}

	existing, err := cfg.DB.GetDividendByIDAndUser(r.Context(), database.GetDividendByIDAndUserParams{
		ID:     dividendID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Güncellenecek temettü kaydı bulunamadı", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Temettü kaydı alınamadı", err)
		}
		return
	}

	if params.PaymentDate.IsZero() {
		params.PaymentDate = time.Now().UTC()
	}

	if params.AmountPerShare != "" && !cfg.amountFromPerShare(w, r, userID, &params) {
		return
	}

	amount, _ := strconv.ParseFloat(params.Amount, 64)
	if amount <= 0 || params.AssetID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Miktar veya Asset ID geçersiz", nil)
		return
	}

	taxRate := storedTaxRate(existing)
	if params.TaxRate != "" {
		if tr, ok := parseTaxRate(params.TaxRate); ok {
			taxRate = tr
		}
	}

	grossAmount, taxAmount, netAmount := splitDividend(amount, taxRate, params.IsNet)
	cleanGross := fmt.Sprintf("%.6f", grossAmount)
	cleanTax := fmt.Sprintf("%.6f", taxAmount)
	cleanNet := fmt.Sprintf("%.6f", netAmount)

	updated, err := cfg.DB.UpdateDividend(r.Context(), database.UpdateDividendParams{
		ID:          dividendID,
		UserID:      userID,
		AssetID:     params.AssetID,
		Amount:      cleanGross,
		PaymentDate: params.PaymentDate,
		GrossAmount: cleanGross,
		TaxAmount:   cleanTax,
		NetAmount:   cleanNet,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Temettü kaydı güncellenemedi", err)
		return
	}

	respondWithJSON(w, http.StatusOK, updated)
}

// HandlerDeleteDividend, bir temettü kaydını soft-delete ile siler.
// Silmeden önce kaydın gerçekten bu kullanıcıya ait olup olmadığını kontrol eder (IDOR koruması).
// @Summary Temettü Kaydını Sil
// @Description Kullanıcının kaydettiği bir temettü gelirini siler
// @Tags Dividends
// @Security BearerAuth
// @Produce json
// @Param id path int true "Temettü ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /dividends/{id} [delete]
func (cfg *ApiConfig) HandlerDeleteDividend(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	dividendID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz temettü ID", err)
		return
	}
	dividends, _ := cfg.DB.GetUserDividends(r.Context(), userID)
	found := false
	for _, d := range dividends {
		if d.ID == dividendID {
			found = true
			break
		}
	}
	if !found {
		respondWithError(w, http.StatusNotFound, "Silinecek temettü kaydı bulunamadı", nil)
		return
	}
	err = cfg.DB.DeleteDividend(r.Context(), database.DeleteDividendParams{
		ID:     dividendID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Temettü silinemedi", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Temettü kaydı başarıyla silindi"})
}
