package handlers

import "testing"

// Stopaj oranı "15" ya da "0.15" gibi gelebilir; 1 ve üstü yüzde sayılır, anlamsız değerler reddedilir.
func TestParseTaxRate(t *testing.T) {
	cases := []struct {
		raw    string
		want   float64
		wantOK bool
	}{
		{"0.15", 0.15, true},
		{"15", 0.15, true},
		{"1", 0.01, true},
		{"0", 0, true},
		{"on", 0, false},
		{"-5", 0, false},
		{"100", 0, false},
	}
	for _, c := range cases {
		got, ok := parseTaxRate(c.raw)
		if ok != c.wantOK || got != c.want {
			t.Errorf("parseTaxRate(%q) = %v, %v; beklenen %v, %v", c.raw, got, ok, c.want, c.wantOK)
		}
	}
}
