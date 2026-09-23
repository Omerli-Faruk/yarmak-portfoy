package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// HashPassword — Kullanıcının düz metin şifresini bcrypt algoritması ile güvenli şekilde hash'ler.
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("şifre hashlenirken hata oluştu: %w", err)
	}
	return string(hashedPassword), nil
}

// CheckPasswordHash — Kullanıcının girdiği şifre ile veritabanındaki hash'lenmiş şifrenin eşleşip eşleşmediğini kontrol eder.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// MakeJWT — Kullanıcı oturumu için kısa ömürlü (ör. 1 saat) bir JSON Web Token (JWT) oluşturur ve imzalar.
func MakeJWT(userID int64, tokenSecret string, expiresIn time.Duration) (string, error) {
	signingKey := []byte(tokenSecret)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    "yarmak",
		IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresIn)),
		Subject:   fmt.Sprintf("%d", userID),
	})
	signedToken, err := token.SignedString(signingKey)
	if err != nil {
		return "", fmt.Errorf("token oluşturulurken hata oluştu: %w", err)
	}
	return signedToken, nil
}

// ValidateJWT — Gelen JWT'nin süresinin geçip geçmediğini, imzasının doğruluğunu ve issuer (yayıncı) bilgisini kontrol eder. Geçerliyse UserID'yi döner.
func ValidateJWT(tokenString, tokenSecret string) (int64, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("beklenmeyen imzalama yöntemi")
		}
		return []byte(tokenSecret), nil
	})
	if err != nil {
		return 0, fmt.Errorf("token doğrulanırken hata oluştu: %w", err)
	}
	if claims.Issuer != "yarmak" {
		return 0, fmt.Errorf("geçersiz token yayıncısı")
	}
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("geçersiz kullanıcı ID: %w", err)
	}
	return userID, nil
}

// MakeRefreshToken — Kullanıcının oturumunu uzun süre açık tutmak için rastgele, güvenli bir 32 baytlık (64 karakter hex) yenileme token'ı üretir.
func MakeRefreshToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", fmt.Errorf("refresh token üretilemedi: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// HashToken — Veritabanında plain-text token saklamamak için, Refresh Token'ı SHA-256 ile hash'leyerek geri döndürür.
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
