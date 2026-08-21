package auth

import (
	"testing"
	"time"
)

func TestPasswordHashing(t *testing.T) {
	password := "MySecretPassword123"
	hashedPassword, err := HashPassword(password)
	if err != nil || hashedPassword == password {
		t.Fatalf("Şifre hashlenirken hata oluştu %v", err)
	}
	if !CheckPasswordHash(password, hashedPassword) {
		t.Errorf("Doğru şifre hash ile eşleşmedi!")
	}
	if CheckPasswordHash("Yanlış Şifre", hashedPassword) {
		t.Errorf("Yanlış şifre hash ile eşleşti!")
	}
}

func TestMakeJWT(t *testing.T) {
	userID := int64(101)
	secret := "super-jwt-key"
	expiresIn := 5 * time.Minute
	token, err := MakeJWT(userID, secret, expiresIn)
	if err != nil {
		t.Fatalf("Token oluşturulurken hata oluştu %v", err)
	}
	parsedID, err := ValidateJWT(token, secret)
	if err != nil || parsedID != 101 {
		t.Errorf("Token doğrulanamadı veya ID yanlış: %v", err)
	}
	_, err = ValidateJWT(token, "tamamen-yanlis-anahtar")
	if err == nil {
		t.Errorf("Yanlış secret ile token geçerli sayılmamalıydı!")
	}
}

func TestValidateJWT(t *testing.T) {
	userID := int64(101)
	secret := "super-jwt-key"
	expiredToken := -1 * time.Hour
	token, err := MakeJWT(userID, secret, expiredToken)
	if err != nil {
		t.Fatalf("Token oluşturulurken hata oluştu %v", err)
	}
	_, err = ValidateJWT(token, secret)
	if err == nil {
		t.Errorf("Süresi dolmuş token doğrulanmamalıydı!")
	}
}
