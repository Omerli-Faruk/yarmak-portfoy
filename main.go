package main

import (
	"borsa_portfoy_backend/internal/database"
	"borsa_portfoy_backend/internal/handlers"
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		slog.Error("Hata .env dosyası yüklenmiyor", "error", err)
		os.Exit(1)
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET bulunamadı")
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
		slog.Error("Can't connect to database", "error", err)
		os.Exit(1)
	}
	if err = conn.Ping(); err != nil {
		slog.Error("The database is inaccessible", "error", err)
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

	// Rate Limiter
	v1Router.Use(httprate.NewRateLimiter(100, 1*time.Minute).Handler)

	// Sağlık Kontrolü
	v1Router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Kullanıcı Rotaları
	v1Router.Post("/register", apiCFG.HandlerRegister)
	v1Router.Post("/login", apiCFG.HandlerLogin)
	v1Router.Get("/me", apiCFG.MiddleWareAuth(apiCFG.HandlerGetMe))

	// Alt router'ı ana router'a bağla
	r.Mount("/v1", v1Router)

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
	serverCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-serverCtx.Done()
	slog.Info("Server kapatılıyor...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = srv.Shutdown(shutdownCtx)
	if err != nil {
		slog.Error("Server kapatılırken hata oluştu", "error", err)
	}
	if err := conn.Close(); err != nil {
		slog.Error("Veritabanı kapatılırken hata oluştu", "error", err)
	}
	slog.Info("Server başarıyla kapatıldı")
}
