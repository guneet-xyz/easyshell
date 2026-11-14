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
	Codename string            `json:"codename"`
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body"`
}

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/" {
			http.NotFound(w, req)
			return
		}
		for name, value := range data.Headers {
			w.Header().Set(name, value)
		}
		w.Header().Set("X-Secret-Codename", data.Codename)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, data.Body)
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
