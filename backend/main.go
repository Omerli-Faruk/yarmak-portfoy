package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"yarmak/internal/auth"
	"yarmak/internal/database"
	"yarmak/internal/handlers"
	"yarmak/internal/router"
	"yarmak/internal/scraper"
	"yarmak/internal/services"

	_ "yarmak/docs"

	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// main, uygulamanın giriş noktası. DB bağlantısı, router kurulumu,
// scraper worker'ları ve HTTP sunucusunu başlatır. Graceful shutdown destekler.
// @title Yarmak Borsa & Portföy Takip API
// @version 1.0
// @description BIST 100 hisseleri, TEFAS yatırım fonları, altın ve döviz portföy takip sistemi REST API dokümantasyonu.
// @description Kimlik doğrulama HttpOnly çerezlerle yapılır (access_token, refresh_token); Authorization başlığı kullanılmaz.
// @description Giriş gerektiren uçları denemek için önce bu sayfadan /login'i çalıştırın: tarayıcı çerezi saklar ve
// @description sonraki istekler aynı adrese gittiği için çerezi kendisi gönderir.
// @BasePath /v1
func main() {
	if err := godotenv.Load(".env"); err != nil {
		slog.Info(".env dosyası bulunamadı, sistem ortam değişkenleri kullanılacak")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		// Anahtar verilmediyse her açılışta rastgele üretilir. Oturumlar refresh token ile
		// yenilendiği için yeniden başlatmada kullanıcılar çıkış yapmış olmaz.
		generated, err := auth.GenerateSecret()
		if err != nil {
			slog.Error("JWT_SECRET üretilemedi", "error", err)
			os.Exit(1)
		}
		jwtSecret = generated
		slog.Warn("JWT_SECRET verilmedi, geçici bir anahtar üretildi; sunucuda `openssl rand -hex 32` ile kalıcı bir anahtar verin")
	}

	if len(jwtSecret) < 32 {
		slog.Error("JWT_SECRET en az 32 karakter olmalıdır")
		os.Exit(1)
	}

	// Repoda geçmiş örnek anahtarlar herkese açık; onlarla imzalanan token'ı herkes üretebilir.
	if auth.IsPublicExampleSecret(jwtSecret) {
		slog.Error("JWT_SECRET repodaki örnek değerlerden biri; `openssl rand -hex 32` ile yeni bir anahtar üretin")
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

	// HTTPS arkasında COOKIE_SECURE=true verilmeli; yerelde http://localhost için false kalır.
	cookieSecure, err := parseCookieSecure(os.Getenv("COOKIE_SECURE"))
	if err != nil {
		slog.Error("COOKIE_SECURE okunamadı; true ya da false yazın", "value", os.Getenv("COOKIE_SECURE"))
		os.Exit(1)
	}

	apiCFG := &handlers.ApiConfig{
		DB:           queries,
		DBConn:       conn,
		JWTSecret:    jwtSecret,
		CookieSecure: cookieSecure,
		Services:     servicesPkg,
		// Yeni sembol araması dış kaynaklara istek attığı için kullanıcı başına dakikada 20 ile sınırlı.
		DiscoveryLimiter: httprate.NewRateLimiter(20, time.Minute),
	}

	r := router.SetupRouter(apiCFG)

	// 1. Sinyal dinleyicisini (Ctrl+C / SIGTERM) oluştur
	serverCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Piyasalar sayfasının ilk isteği soğuk veritabanı önbelleğinde 10 sn'yi buluyordu (#51). Aynı sorgu işçiler
	// başlamadan bir kez çalıştırılır; sonraki istekler ~30 ms.
	warmUpQueries(serverCtx, queries)

	// 2. Arka Plan Scraper Worker'ı context ile Başlat
	var scraperWg sync.WaitGroup
	scraper.StartScraperWorker(serverCtx, queries, &scraperWg)
	srv := &http.Server{
		Handler:      r,
		Addr:         ":" + port,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	slog.Info("Server Başlatılıyor...", "port", port)
	// Sunucu açılamazsa (ör. port dolu) düzgün kapanılır ama çıkış kodu 1 olur; Docker ve izleme araçları hatayı görsün.
	var serverFailed atomic.Bool
	go func() {
		// Kendi err'i: dıştaki err'e yazsaydı main'in Shutdown'daki err'iyle aynı anda yazılıp yarış olurdu.
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server hata verdi", "error", err)
			serverFailed.Store(true)
			stop()
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
	if serverFailed.Load() {
		slog.Error("Server hatayla kapandı")
		os.Exit(1)
	}
	slog.Info("Server başarıyla kapatıldı")
}

// warmUpQueries, sık kullanılan ağır sorguyu açılışta bir kez çalıştırıp veritabanı önbelleğini ısıtır.
// En fazla 20 sn bekler; başaramazsa yalnızca uyarı yazar, açılışı durdurmaz.
func warmUpQueries(ctx context.Context, q *database.Queries) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	start := time.Now()
	if _, err := q.GetAssetDailyChangesAll(ctx); err != nil {
		slog.Warn("Açılış ısıtma sorgusu tamamlanamadı", "error", err)
		return
	}
	slog.Info("Veritabanı önbelleği ısıtıldı", "sure", time.Since(start).Round(time.Millisecond))
}

// parseCookieSecure: boş değer false. "evet" gibi okunamayan bir değer hata döner; eskiden sessizce false
// sayılıyordu ve HTTPS'te oturum çerezleri Secure bayrağı olmadan yazılıyordu (#17).
func parseCookieSecure(raw string) (bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false, nil
	}
	return strconv.ParseBool(raw)
}
