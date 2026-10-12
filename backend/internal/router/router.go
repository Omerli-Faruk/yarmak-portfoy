package router

import (
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"os"
	"strconv"
	"strings"
	"time"
	"yarmak/internal/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

// TRUSTED_PROXIES boşsa yalnızca aynı makineden gelen bağlantılara (Next.js sunucusu) güveniyoruz.
const defaultTrustedProxies = "127.0.0.1/32,::1/128"

// parseTrustedProxies, virgülle ayrılmış CIDR listesini çözer. Tek IP de yazılabilir.
// Hatalı girişleri loglayıp atlar.
func parseTrustedProxies(raw string) []netip.Prefix {
	if strings.TrimSpace(raw) == "" {
		raw = defaultTrustedProxies
	}
	var prefixes []netip.Prefix
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if prefix, err := netip.ParsePrefix(part); err == nil {
			prefixes = append(prefixes, prefix.Masked())
			continue
		}
		if addr, err := netip.ParseAddr(part); err == nil {
			addr = addr.Unmap()
			prefixes = append(prefixes, netip.PrefixFrom(addr, addr.BitLen()))
			continue
		}
		slog.Warn("TRUSTED_PROXIES içinde geçersiz adres atlandı", "value", part)
	}
	return prefixes
}

// isTrustedPeer, bağlantının güvendiğimiz bir adresten gelip gelmediğine bakar.
func isTrustedPeer(remoteAddr string, trusted []netip.Prefix) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	ip = ip.Unmap().WithZone("")
	for _, prefix := range trusted {
		if prefix.Contains(ip) {
			return true
		}
	}
	return false
}

// clientIPMiddleware, rate limiter'ların kullandığı istemci IP'sini context'e yazar.
// X-Real-IP başlığına yalnızca bağlantı güvenilen bir adresten geliyorsa bakılır; başlık yoksa
// ya da geçersizse bağlantının kendi adresi kalır. Diğer herkes için başlık yok sayılır.
func clientIPMiddleware(trusted []netip.Prefix) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		fromHeader := middleware.ClientIPFromRemoteAddr(middleware.ClientIPFromHeader("X-Real-IP")(next))
		fromRemote := middleware.ClientIPFromRemoteAddr(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isTrustedPeer(r.RemoteAddr, trusted) {
				fromHeader.ServeHTTP(w, r)
				return
			}
			fromRemote.ServeHTTP(w, r)
		})
	}
}

// keyByClientIP — Rate limiter anahtarı. clientIPMiddleware'in belirlediği IP'yi kullanır;
// o çalışmamışsa bağlantının adresine düşer.
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

// swaggerEnabled, ENABLE_SWAGGER boşsa ya da okunamıyorsa true döner; yalnızca açıkça false verilirse kapanır.
func swaggerEnabled(raw string) bool {
	v, err := strconv.ParseBool(strings.TrimSpace(raw))
	return err != nil || v
}

func SetupRouter(apiCFG *handlers.ApiConfig) chi.Router {
	r := chi.NewRouter()

	v1Router := chi.NewRouter()

	v1Router.Use(middleware.RequestID)
	v1Router.Use(clientIPMiddleware(parseTrustedProxies(os.Getenv("TRUSTED_PROXIES"))))
	v1Router.Use(middleware.Logger)
	v1Router.Use(middleware.Recoverer)

	// Genel istek sınırı; arayüzde hızlı gezinmeyi engellemeyecek kadar geniş tutuldu.
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

	// Kullanıcı rotaları. Kayıt ve girişte deneme yanılmaya karşı dakikada 5 istek sınırı var.
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

	// İşlem ve portföy rotaları (giriş gerektirir)
	v1Router.Post("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerCreateTransaction))
	v1Router.Get("/transactions", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserTransactions))
	v1Router.Get("/portfolio/holdings", apiCFG.MiddleWareAuth(apiCFG.HandlerGetUserHoldings))
	v1Router.Delete("/portfolio/holdings/{symbol}", apiCFG.MiddleWareAuth(apiCFG.HandlerDeleteUserAssetHoldings))
	v1Router.Get("/portfolio/summary", apiCFG.MiddleWareAuth(apiCFG.HandlerGetPortfolioSummary))
	v1Router.Get("/portfolio/value-history", apiCFG.MiddleWareAuth(apiCFG.HandlerGetPortfolioValueHistory))
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
	// Swagger arayüzü yerelde açık; ENABLE_SWAGGER=false ile kapatılır.
	if swaggerEnabled(os.Getenv("ENABLE_SWAGGER")) {
		r.Get("/swagger/*", httpSwagger.WrapHandler)
	}

	return r
}
