package handlers

import (
	"borsa_portfoy_backend/internal/database"
	"encoding/json"
	"net/http"
)

func (cfg *ApiConfig) HandlerCreateAsset(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		Symbol       string `json:"symbol"`
		Name         string `json:"name"`
		AssetType    string `json:"asset_type"`
		CurrentPrice string `json:"current_price"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Geçersiz istek", err)
		return
	}
	asset, err := cfg.DB.CreateAsset(r.Context(), database.CreateAssetParams{
		Symbol:       params.Symbol,
		Name:         params.Name,
		AssetType:    params.AssetType,
		CurrentPrice: params.CurrentPrice,
	})
	if err != nil {
		respondWithError(w, http.StatusConflict, "Asset oluşturulamadı", err)
		return
	}
	respondWithJSON(w, http.StatusCreated, asset)
}

func (cfg *ApiConfig) HandlerListAssets(w http.ResponseWriter, r *http.Request) {
	asset, err := cfg.DB.ListAssets(r.Context())
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Asset bulunamadı", err)
		return
	}
	respondWithJSON(w, http.StatusOK, asset)
}
