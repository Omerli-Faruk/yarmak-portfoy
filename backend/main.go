package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
	"yarmak/internal/database"
	"yarmak/internal/handlers"
	"yarmak/internal/router"
	"yarmak/internal/scraper"
	"yarmak/internal/services"

	_ "yarmak/docs"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// main — Uygulamanın giriş noktası. DB bağlantısı, router kurulumu,
// scraper worker'ları ve HTTP sunucusunu başlatır. Graceful shutdown destekler.
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

	servicesPkg := services.NewServices(queries, conn)

	apiCFG := &handlers.ApiConfig{
		DB:        queries,
		DBConn:    conn,
		JWTSecret: jwtSecret,
		Services:  servicesPkg,
	}

	r := router.SetupRouter(apiCFG)

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
