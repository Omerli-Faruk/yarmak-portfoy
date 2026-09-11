package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	reqBody := map[string]interface{}{
		"fonTipi":  "YAT",
		"fonKodu":  "",
		"basTarih": "20230101",
		"bitTarih": "20230131",
		"basSira":  1,
		"bitSira":  100000,
		"dil":      "TR",
	}
	jsonBytes, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir", bytes.NewBuffer(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %d, Response Length: %d\n", resp.StatusCode, len(body))
	fmt.Println(string(body))
}
