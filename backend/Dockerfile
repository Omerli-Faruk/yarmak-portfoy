# ==========================================
# Stage 1: Build Stage (Derleme Ortamı)
# ==========================================
FROM golang:alpine AS builder

WORKDIR /app

# Gerekli derleme paketleri
RUN apk add --no-cache git ca-certificates tzdata

# Goose migration aracını derle
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.24.1

# Bağımlılıkları önbelleğe almak için go.mod ve go.sum
COPY go.mod go.sum ./
RUN go mod download

# Tüm kaynak kodları kopyala
COPY . .

# Ana API sunucusunu statik binary olarak derle
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/server main.go

# Seed aracını derle
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/seed cmd/seed/main.go

# Deep Seeder aracını derle
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/deep_seeder cmd/tefas_deep_seeder/main.go

# ==========================================
# Stage 2: Runtime Stage (Minimal Çalışma Ortamı)
# ==========================================
FROM alpine:3.20

WORKDIR /app

# HTTPS istekleri için CA sertifikaları ve Türkiye zaman dilimi
RUN apk add --no-cache ca-certificates tzdata

ENV TZ=Europe/Istanbul

# Builder'dan derlenmiş binary'leri ve Goose aracını kopyala
COPY --from=builder /app/bin/server /app/server
COPY --from=builder /app/bin/seed /app/seed
COPY --from=builder /app/bin/deep_seeder /app/deep_seeder
COPY --from=builder /go/bin/goose /usr/local/bin/goose

# Migration SQL şema dosyalarını kopyala
COPY sql/schema /app/sql/schema

# Swagger dokümanlarını kopyala
COPY docs /app/docs

EXPOSE 8080

CMD ["/app/server"]