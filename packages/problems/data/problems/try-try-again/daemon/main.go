package main

import (
	_ "embed"
	"encoding/json"
	"io"
	"net/http"
	"sync"
)

//go:embed data.json
var dataJSON []byte

type Data struct {
	// Number of requests that fail before the server wakes up.
	Failures int `json:"failures"`
	// Bodies of the failed responses, used in turn.
	Errors  []string `json:"errors"`
	Fortune string   `json:"fortune"`
}

var (
	requests = 0
	mu       sync.Mutex
)

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/fortune", func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		requests++
		attempt := requests
		mu.Unlock()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		if attempt <= data.Failures {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = io.WriteString(w, data.Errors[(attempt-1)%len(data.Errors)])
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, data.Fortune)
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
