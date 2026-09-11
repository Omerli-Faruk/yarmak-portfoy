package main

import (
	"fmt"
	"yarmak/internal/scraper"
)

func main() {
	fmt.Println("Fetching THYAO...")
	price, history, err := scraper.FetchBISTHistory("THYAO", "5y")
	if err != nil {
		panic(err)
	}
	fmt.Printf("Current Price: %f\n", price)
	fmt.Printf("Total History Rows: %d\n", len(history))
	if len(history) > 0 {
		fmt.Printf("First Record: %+v\n", history[0])
		fmt.Printf("Last Record: %+v\n", history[len(history)-1])
	}
}
