package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/handlers"
	"yarmak/internal/scraper"

	_ "yarmak/docs"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

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

// @title Yarmak Borsa & Portföy Takip API
// @version 1.0
// @description BIST 100 hisseleri, TEFAS yatırım fonları, altın ve döviz portföy takip sistemi REST API dokümantasyonu.
// @host localhost:8080
// @BasePath /v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT Token'ınızı 'Bearer <token>' formatında giriniz.
func main() {
	if err := godotenv.Load(".env"); err != nil {
		slog.Info(".env dosyası bulunamadı, sistem ortam değişkenleri kullanılacak")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET bulunamadı")
		os.Exit(1)
	}

	if len(jwtSecret) < 32 {
		slog.Error("JWT_SECRET en az 32 karakter olmalıdır")
		os.Exit(1)
	}

	port := os.Getenv("PORT")
	if port == "" {
		slog.Error("$PORT yazılmış olması gerekiyor")
		os.Exit(1)
	}

	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		slog.Error("$DB_URL yazılmış olması gerekiyor")
		os.Exit(1)
	}

	conn, err := sql.Open("postgres", dbUrl)
	if err != nil {
		slog.Error("Veritabanına bağlanılamadı", "error", err)
		os.Exit(1)
	}
	if err = conn.Ping(); err != nil {
		slog.Error("Veritabanına erişilemiyor", "error", err)
		os.Exit(1)
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(25)
	conn.SetConnMaxLifetime(5 * time.Minute)

	queries := database.New(conn)

	apiCFG := &handlers.ApiConfig{
		DB:        queries,
		DBConn:    conn,
		JWTSecret: jwtSecret,
	}

	r := chi.NewRouter()

	v1Router := chi.NewRouter()

	v1Router.Use(middleware.RequestID)
	v1Router.Use(middleware.Logger)
	v1Router.Use(middleware.Recoverer)

	// Rate Limiter
	v1Router.Use(httprate.NewRateLimiter(100, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler)

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
	if err != nil {
		slog.Error("CORS yapılandırma hatası", "error", err)
		os.Exit(1)
	}

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
	lookupRateLimiter := httprate.NewRateLimiter(10, 1*time.Minute, httprate.WithKeyFuncs(keyByClientIP)).Handler
	v1Router.With(authRateLimiter).Post("/register", apiCFG.HandlerRegister)
	v1Router.With(authRateLimiter).Post("/login", apiCFG.HandlerLogin)
	v1Router.Get("/me", apiCFG.MiddleWareAuth(apiCFG.HandlerGetMe))
	v1Router.With(authRateLimiter).Post("/refresh", apiCFG.HandlerRefreshToken)
	v1Router.With(authRateLimiter).Post("/revoke", apiCFG.HandlerRevokeToken)

	// Asset (Hisse/Fon) Rotaları
	v1Router.Post("/assets", apiCFG.MiddleWareAuth(apiCFG.MiddleWareAdmin(apiCFG.HandlerCreateAsset)))
	v1Router.Get("/assets", apiCFG.HandlerListAssets)
	v1Router.With(lookupRateLimiter).Get("/assets/lookup", apiCFG.MiddleWareAuth(apiCFG.HandlerLookupAsset))
	v1Router.Post("/splits", apiCFG.MiddleWareAuth(apiCFG.MiddleWareAdmin(apiCFG.HandlerCreateSplit)))
	v1Router.Get("/assets/{id}/splits", apiCFG.MiddleWareAuth(apiCFG.HandlerListSplitsByAsset))

	// İşlem ve Portföy Rotaları (JWT Korumalı!)
	v1Router.Post("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerCreateTransaction))
	v1Router.Get("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserTransactions))
	v1Router.Get("/portfolio/holdings", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserHoldings))
	v1Router.Get("/portfolio/summary", apiCFG.MiddleWareAuth(apiCFG.HandlerGetPortfolioSummary))
	v1Router.Delete("/transactions/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteTransaction))
	v1Router.Get("/assets/{id}/price-history", apiCFG.HandlerGetAssetPriceHistory)
	v1Router.Post("/assets/{id}/backfill", apiCFG.HandlerTriggerBackfill)
	v1Router.Post("/dividends", apiCFG.MiddleWareAuth(apiCFG.HandlerCreateDividend))
	v1Router.Get("/dividends", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserDividends))
	v1Router.Delete("/dividends/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteDividend))
	v1Router.Post("/alerts", apiCFG.MiddleWareAuth(apiCFG.HandlerCreatePriceAlert))
	v1Router.Get("/alerts", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserPriceAlerts))
	v1Router.Delete("/alerts/{id}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeletePriceAlert))
	v1Router.Get("/portfolio/history", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserPortfolioHistory))

	// Alt router'ı ana router'a bağla
	r.Mount("/v1", v1Router)
	r.Get("/swagger/*", httpSwagger.WrapHandler)

	// 1. Sinyal dinleyicisini (Ctrl+C / SIGTERM) oluştur
	serverCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 2. Arka Plan Scraper Worker'ı context ile Başlat
	var scraperWg sync.WaitGroup
	scraper.StartScraperWorker(serverCtx, queries, 1*time.Minute, &scraperWg)
	srv := &http.Server{
		Handler: r,
		Addr:    ":" + port,
	}
	slog.Info("Server Başlatılıyor...", "port", port)
	go func() {
		err = srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server hata verdi", "error", err)
		}
	}()
	// Sunucunun kapanmasını bekle
	<-serverCtx.Done()
	slog.Info("Server kapatılıyor...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = srv.Shutdown(shutdownCtx)
	if err != nil {
		slog.Error("Server kapatılırken hata oluştu", "error", err)
	}
	slog.Info("Arka plan servislerinin tamamlanması bekleniyor...")
	scraperWg.Wait()
	if err := conn.Close(); err != nil {
		slog.Error("Veritabanı kapatılırken hata oluştu", "error", err)
	}
	slog.Info("Server başarıyla kapatıldı")
}
