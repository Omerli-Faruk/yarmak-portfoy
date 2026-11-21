package main

import "testing"

// #17: yanlış yazılan COOKIE_SECURE sessizce false olmamalı.
func TestParseCookieSecure(t *testing.T) {
	tests := []struct {
		raw     string
		want    bool
		wantErr bool
	}{
		{"", false, false},
		{"true", true, false},
		{" TRUE ", true, false},
		{"false", false, false},
		{"1", true, false},
		{"evet", false, true},
		{"yes", false, true},
	}
	for _, tt := range tests {
		got, err := parseCookieSecure(tt.raw)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("parseCookieSecure(%q) = %v, %v; beklenen %v, hata %v", tt.raw, got, err, tt.want, tt.wantErr)
		}
	}
}
