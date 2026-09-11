package main

import (
	"fmt"
	"time"
	"yarmak/internal/scraper"
)

func main() {
	fmt.Println("Fetching TEFAS fund MAC...")
	history, err := scraper.FetchTEFASFundHistory("MAC", time.Now().AddDate(0, -1, 0), time.Now())
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		fmt.Printf("Fetched %d records.\n", len(history))
		if len(history) > 0 {
			fmt.Printf("Last: %+v\n", history[len(history)-1])
		}
	}
}
