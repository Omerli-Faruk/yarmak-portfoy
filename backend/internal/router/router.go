package router

import (
	"net"
	"net/http"
	"os"
	"strings"
	"time"
	"yarmak/internal/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

// keyByClientIP — Rate limiter için istemci IP'sini çıkarır.
// Proxy arkasındaysa X-Forwarded-For'u, değilse doğrudan RemoteAddr kullanır.
func keyByClientIP(r *http.Request) (string, error) {
	ip := middleware.GetClientIP(r.Context())
	if ip == "" {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err == nil {
			ip = host
		} else {
			ip = r.RemoteAddr
		}
	}
	return httprate.CanonicalizeIP(ip), nil
}

func SetupRouter(apiCFG *handlers.ApiConfig) chi.Router {
	r := chi.NewRouter()

	v1Router := chi.NewRouter()

	v1Router.Use(middleware.RequestID)
	v1Router.Use(middleware.Logger)
	v1Router.Use(middleware.Recoverer)

	// Rate Limiter (Geliştirme ve hızlı UI gezinmeleri için cömert limit)
	v1Router.Use(httprate.NewRateLimiter(1000, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler)

	allowedOriginsStr := os.Getenv("ALLOWED_ORIGINS")
	var allowedOrigins []string
	if allowedOriginsStr != "" {
		for _, o := range strings.Split(allowedOriginsStr, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"}
	}
	corsMiddleware := cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	v1Router.Use(corsMiddleware)

	v1Router.Use(middleware.Timeout(15 * time.Second))

	v1Router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			next.ServeHTTP(w, r)
		})
	})

	// Sağlık Kontrolü
	v1Router.Get("/healthz", handlers.HandlerReadiness)

	// Kullanıcı Rotaları (Özel Brute-Force Korumalı Rate Limiter: 5 istek / dakika)
	authRateLimiter := httprate.NewRateLimiter(5, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler
	refreshRateLimiter := httprate.NewRateLimiter(60, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler
	lookupRateLimiter := httprate.NewRateLimiter(10, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler
	v1Router.With(authRateLimiter).Post("/register", apiCFG.HandlerRegister)
	v1Router.With(authRateLimiter).Post("/login", apiCFG.HandlerLogin)
	v1Router.Get("/me", apiCFG.MiddleWareAuth(apiCFG.HandlerGetMe))
	v1Router.With(refreshRateLimiter).Post("/refresh", apiCFG.HandlerRefreshToken)
	v1Router.Post("/revoke", apiCFG.HandlerRevokeToken)

	// Asset (Hisse/Fon) Rotaları
	v1Router.Post("/assets", apiCFG.MiddleWareAuth(apiCFG.MiddleWareAdmin(apiCFG.HandlerCreateAsset)))
	v1Router.Get("/assets", apiCFG.HandlerListAssets)
	v1Router.Get("/assets/lookup", apiCFG.HandlerLookupAsset)
	v1Router.Get("/assets/daily-changes", apiCFG.HandlerGetAssetDailyChanges)
	v1Router.Post("/splits", apiCFG.MiddleWareAuth(apiCFG.MiddleWareAdmin(apiCFG.HandlerCreateSplit)))
	v1Router.Get("/assets/{id}/splits", apiCFG.MiddleWareAuth(apiCFG.HandlerListSplitsByAsset))

	// İşlem ve Portföy Rotaları (JWT Korumalı!)
	v1Router.Post("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerCreateTransaction))
	v1Router.Get("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserTransactions))
	v1Router.Get("/portfolio/holdings", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserHoldings))
	v1Router.Delete("/portfolio/holdings/{symbol}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteUserAssetHoldings))
	v1Router.Get("/portfolio/summary", apiCFG.MiddleWareAuth(apiCFG.HandlerGetPortfolioSummary))
	v1Router.Delete("/transactions/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteTransaction))
	v1Router.Put("/transactions/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerUpdateTransaction))
	v1Router.Get("/assets/{id}/price-history", apiCFG.HandlerGetAssetPriceHistory)
	v1Router.Get("/assets/{id}/summary", apiCFG.HandlerGetAssetSummary)
	v1Router.With(lookupRateLimiter).Post("/assets/{id}/backfill", apiCFG.HandlerTriggerBackfill)
	v1Router.Post("/dividends", apiCFG.MiddleWareAuth(apiCFG.HandlerCreateDividend))
	v1Router.Get("/dividends", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserDividends))
	v1Router.Put("/dividends/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerUpdateDividend))
	v1Router.Delete("/dividends/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteDividend))
	v1Router.Post("/alerts", apiCFG.MiddleWareAuth(apiCFG.HandlerCreatePriceAlert))
	v1Router.Get("/alerts", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserPriceAlerts))
	v1Router.Delete("/alerts/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeletePriceAlert))
	v1Router.Get("/portfolio/history", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserPortfolioHistory))

	// Alt router'ı ana router'a bağla
	r.Mount("/v1", v1Router)
	r.Get("/swagger/*", httpSwagger.WrapHandler)

	return r
}
