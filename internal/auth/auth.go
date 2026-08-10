package auth

import (
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("şifre hashlenirken hata oluştu: %w", err)
	}
	return string(hashedPassword), nil
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func MakeJWT(userID int64, tokenSecret string, expiresIn time.Duration) (string, error) {
	signingKey := []byte(tokenSecret)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    "midas-portfoy",
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

func ValidateJWT(tokenString, tokenSecret string) (int64, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) { return []byte(tokenSecret), nil })
	if err != nil {
		return 0, fmt.Errorf("token doğrulanırken hata oluştu: %w", err)
	}
	if claims.Issuer != "midas-portfoy" {
		return 0, fmt.Errorf("geçersiz token yayıncısı")
	}
	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("geçersiz kullanıcı ID: %w", err)
	}
	return userID, nil
}
