package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"time"
	"yarmak/internal/database"
	"yarmak/internal/scraper"
	"yarmak/internal/services"

	"github.com/go-chi/chi/v5"
)

// HandlerCreateTransaction — Kullanıcı portföyüne yeni bir alım (BUY) veya satım (SELL) işlemi kaydeder. İleri tarihli işlemleri engeller, split (bölünme) geçmişini hesaba katar.
// @Summary Alım/Satım İşlemi Yap
// @Description Kullanıcı portföyüne yeni bir alım (BUY) veya satım (SELL) işlemi kaydeder
// @Tags Transactions
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body createTransactionRequest true "İşlem Bilgileri"
// @Success 201 {object} database.Transaction
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /transactions [post]
func (cfg *ApiConfig) HandlerCreateTransaction(w http.ResponseWriter, r *http.Request) {

	decoder := json.NewDecoder(r.Body)
	params := createTransactionRequest{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.TransactionDate.IsZero() {
		params.TransactionDate = time.Now().UTC()
	}
	if params.TransactionDate.After(time.Now().Add(2 * time.Minute)) {
		respondWithError(w, http.StatusBadRequest, "Gelecek tarihli işlem kaydedilemez", nil)
		return
	}
	if err := cfg.resolveAssetID(r.Context(), &params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	if params.Type != "BUY" && params.Type != "SELL" {
		respondWithError(w, http.StatusBadRequest, "İşlem tipi 'BUY' veya 'SELL' olmalıdır", nil)
		return
	}

	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	unlock := services.LockUser(userID)
	defer unlock()

	dto := services.CreateTransactionDTO{
		AssetID:         params.AssetID,
		Type:            params.Type,
		Amount:          params.Amount,
		Price:           params.Price,
		TransactionDate: params.TransactionDate,
		Commission:      params.Commission,
	}

	transaction, err := cfg.Services.Transaction.CreateTransaction(r.Context(), userID, dto)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "0'dan büyük olmalıdır") || strings.Contains(msg, "Yetersiz bakiye") || strings.Contains(msg, "eksiye düşürüyor") {
			respondWithError(w, http.StatusBadRequest, msg, nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "İşlem kaydedilemedi, lütfen biraz sonra tekrar deneyin", err)
		}
		return
	}

	// Varlık fiyatı 15 dakikadan eskiyse arka planda piyasa verisini otomatik güncelle
	go func(assetID int64) {
		assetObj, err := cfg.Services.Asset.GetAssetByIDWithCache(context.Background(), assetID)
		if err == nil && time.Since(assetObj.UpdatedAt) > 15*time.Minute {
			_ = scraper.QuickSyncAsset(context.Background(), cfg.DB, assetObj)
		}
	}(params.AssetID)

	respondWithJSON(w, http.StatusCreated, transaction)
}

// HandlerGetUserHoldings — Kullanıcının portföyündeki varlıkları özet olarak listeler. Ortalama maliyet ve anlık fiyat farkına göre anlık Kâr/Zarar durumunu hesaplar.
// @Summary Kullanıcının Varlıklarını (Holdings) Listele
// @Description Kullanıcının sahip olduğu tüm varlıkları, lot sayılarını ve kâr/zararlarını döner
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Success 200 {array} userHoldingResponse
// @Failure 401 {object} map[string]string
// @Router /portfolio/holdings [get]
func (cfg *ApiConfig) HandlerGetUserHoldings(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	holdings, err := cfg.Services.Transaction.GetUserHoldings(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Portföy bilgileri alınamadı", err)
		return
	}
	if len(holdings) == 0 {
		respondWithJSON(w, http.StatusOK, []userHoldingResponse{})
		return
	}
	respondWithJSON(w, http.StatusOK, holdings)
}

// HandlerGetUserTransactions — Kullanıcının işlem geçmişini sayfalayarak (pagination) getirir.
// @Summary İşlem Geçmişi (Pagination)
// @Description Kullanıcının geçmiş alım/satım işlemlerini sayfalanmış olarak listeler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
// @Param page query int false "Sayfa Numarası" default(1)
// @Param limit query int false "Sayfa Başına Kayıt Sayısı" default(10)
// @Success 200 {array} database.Transaction
// @Failure 401 {object} map[string]string
// @Router /transactions [get]
func (cfg *ApiConfig) HandlerGetUserTransactions(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	transactions, err := cfg.DB.GetUserTransactionsPaginated(r.Context(), database.GetUserTransactionsPaginatedParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "İşlemler alınamadı, lütfen biraz sonra tekrar deneyin", err)
		return
	}
	respondWithJSON(w, http.StatusOK, transactions)
}

// HandlerDeleteTransaction — Kullanıcının bir işlemini siler. Silinecek alım, sonraki satışlarda bakiyeyi eksiye düşürecekse silmeye izin vermez.
// @Summary Alım/Satım İşlemini Sil
// @Description Kullanıcının gerçekleştirdiği bir alım veya satım işlemini siler
// @Tags Transactions
// @Security BearerAuth
// @Produce json
// @Param id path int true "İşlem ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [delete]
func (cfg *ApiConfig) HandlerDeleteTransaction(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	transactionID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz işlem ID", err)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	unlock := services.LockUser(userID)
	defer unlock()

	if _, err := cfg.DB.GetTransactionByIDAndUser(r.Context(), database.GetTransactionByIDAndUserParams{
		ID:     transactionID,
		UserID: userID,
	}); err != nil {
		respondWithError(w, http.StatusNotFound, "İşlem bulunamadı veya yetkiniz yok", err)
		return
	}

	err = cfg.Services.Transaction.DeleteTransaction(r.Context(), userID, transactionID)
	if err != nil {
		if strings.Contains(err.Error(), "bakiye eksiye düşecektir") {
			respondWithError(w, http.StatusBadRequest, err.Error(), nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "İşlem silinemedi, lütfen biraz sonra tekrar deneyin", err)
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "İşlem başarıyla silindi"})
}

// updateTransactionRequest — İşlem güncelleme gövdesi
type updateTransactionRequest struct {
	Type            string    `json:"type" example:"BUY" enums:"BUY,SELL"`
	Amount          float64   `json:"amount" example:"100"`
	Price           float64   `json:"price" example:"25.50"`
	TransactionDate time.Time `json:"transaction_date"`
	Commission      float64   `json:"commission" example:"10.0"`
}

// HandlerUpdateTransaction — Kullanıcının mevcut alım/satım işlemini günceller ve WAC / K-Z hesaplarını otomatik yeniler.
// @Summary Alım/Satım İşlemini Güncelle
// @Description Kullanıcının gerçekleştirdiği bir alım veya satım işleminin adet, fiyat, komisyon veya tarihini günceller
// @Tags Transactions
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "İşlem ID"
// @Param body body updateTransactionRequest true "Güncellenecek işlem bilgileri"
// @Success 200 {object} database.Transaction
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions/{id} [put]
func (cfg *ApiConfig) HandlerUpdateTransaction(w http.ResponseWriter, r *http.Request) {
	urlID := chi.URLParam(r, "id")
	transactionID, err := strconv.ParseInt(urlID, 10, 64)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz işlem ID", err)
		return
	}

	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}

	var params updateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek gövdesi", err)
		return
	}

	if params.Type != "BUY" && params.Type != "SELL" {
		respondWithError(w, http.StatusBadRequest, "İşlem türü sadece 'BUY' veya 'SELL' olabilir", nil)
		return
	}
	if params.Amount <= 0 {
		respondWithError(w, http.StatusBadRequest, "İşlem miktarı sıfırdan büyük olmalıdır", nil)
		return
	}
	if params.Price <= 0 {
		respondWithError(w, http.StatusBadRequest, "İşlem fiyatı sıfırdan büyük olmalıdır", nil)
		return
	}
	if params.Commission < 0 {
		params.Commission = 0
	}
	if params.TransactionDate.After(time.Now().Add(2 * time.Minute)) {
		respondWithError(w, http.StatusBadRequest, "Gelecek tarihli işlem kaydedilemez", nil)
		return
	}

	unlock := services.LockUser(userID)
	defer unlock()

	tx, err := cfg.DB.GetTransactionByIDAndUser(r.Context(), database.GetTransactionByIDAndUserParams{
		ID:     transactionID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "İşlem bulunamadı veya yetkiniz yok", err)
		return
	}
	// Tarih gönderilmemişse işlemin mevcut tarihini koruyoruz.
	if params.TransactionDate.IsZero() {
		params.TransactionDate = tx.TransactionDate
	}

	dto := services.UpdateTransactionDTO{
		Type:            params.Type,
		Amount:          params.Amount,
		Price:           params.Price,
		TransactionDate: params.TransactionDate,
		Commission:      params.Commission,
	}

	updatedTx, err := cfg.Services.Transaction.UpdateTransaction(r.Context(), userID, transactionID, dto)
	if err != nil {
		if strings.Contains(err.Error(), "eksiye düşürmektedir") {
			respondWithError(w, http.StatusBadRequest, err.Error(), nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "İşlem güncellenemedi, lütfen biraz sonra tekrar deneyin", err)
		}
		return
	}

	respondWithJSON(w, http.StatusOK, updatedTx)
}

// HandlerDeleteUserAssetHoldings — Kullanıcının bir varlıktaki tüm alım-satım işlemlerini siler, yani varlığı portföyden tamamen kaldırır.
// @Summary Varlığı Portföyden Tamamen Sil
// @Description Kullanıcının belirtilen sembole ait tüm işlemlerini soft-delete yaparak portföyünden kaldırır.
// @Tags Portfolio
// @Security BearerAuth
// @Produce json
// @Param symbol path string true "Varlık Sembolü (örn. THYAO, ASELS)"
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /portfolio/holdings/{symbol} [delete]
func (cfg *ApiConfig) HandlerDeleteUserAssetHoldings(w http.ResponseWriter, r *http.Request) {
	symbol := chi.URLParam(r, "symbol")
	if symbol == "" {
		respondWithError(w, http.StatusBadRequest, "Varlık sembolü belirtilmedi", nil)
		return
	}
	userID, ok := r.Context().Value(UserIDKey).(int64)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Yetkisiz erişim", nil)
		return
	}
	unlock := services.LockUser(userID)
	defer unlock()

	cleanSymbol := strings.ToUpper(strings.TrimSpace(symbol))
	asset, err := cfg.DB.GetAssetBySymbol(r.Context(), cleanSymbol)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Varlık bulunamadı", err)
		return
	}

	// Tek sorguyla siliyoruz; yarıda kesilip bazı işlemlerin kalması mümkün olmasın.
	if err := cfg.DB.DeleteUserAssetTransactions(r.Context(), database.DeleteUserAssetTransactionsParams{
		UserID:  userID,
		AssetID: asset.ID,
	}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Varlık işlemleri silinemedi", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("%s varlığı ve tüm işlemleri portföyünüzden başarıyla silindi", cleanSymbol),
	})
}

// resolveAssetID — İşlem yapılmak istenen varlığın (asset) ID'si yoksa sembolü üzerinden veritabanından bulur veya yenisini oluşturur.
func (cfg *ApiConfig) resolveAssetID(ctx context.Context, params *createTransactionRequest) error {
	if params.AssetID > 0 {
		if cfg.DB != nil {
			_, err := cfg.Services.Asset.GetAssetByIDWithCache(ctx, params.AssetID)
			if err == nil {
				return nil
			}
		} else {
			return nil
		}
	}
	if params.Symbol == "" {
		return fmt.Errorf("varlık ID veya Sembol zorunludur")
	}
	if params.AssetType == "" {
		params.AssetType = "HISSE"
	}
	asset, err := cfg.Services.Asset.GetOrCreateAssetBySymbol(ctx, params.Symbol, params.AssetType)
	if err != nil {
		return err
	}
	params.AssetID = asset.ID
	return nil
}
