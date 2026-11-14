package main

import (
	_ "embed"
	"encoding/json"
	"io"
	"net/http"
)

//go:embed data.json
var dataJSON []byte

type Data struct {
	Status int    `json:"status"`
	Body   string `json:"body"`
}

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(data.Status)
		// For HEAD requests, net/http sends the headers and drops the body.
		_, _ = io.WriteString(w, data.Body)
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
