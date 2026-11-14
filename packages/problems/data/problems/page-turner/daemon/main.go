package main

import (
	_ "embed"
	"encoding/json"
	"net/http"
)

//go:embed data.json
var dataJSON []byte

type Post struct {
	Id      int    `json:"id"`
	Author  string `json:"author"`
	Content string `json:"content"`
}

type Page struct {
	Posts []Post `json:"posts"`
	Next  *int   `json:"next"`
}

type Data struct {
	// Pages by page number. Some of them aren't linked from page 1.
	Pages map[string]Page `json:"pages"`
}

type ErrorResponse struct {
	Error string `json:"error"`
	Posts []Post `json:"posts"`
	Next  *int   `json:"next"`
}

func writeJSON(w http.ResponseWriter, status int, object interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(object); err != nil {
		panic("Error while encoding response: " + err.Error())
	}
}

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/posts", func(w http.ResponseWriter, req *http.Request) {
		number := req.URL.Query().Get("page")
		if number == "" {
			number = "1"
		}
		page, ok := data.Pages[number]
		if !ok {
			writeJSON(w, http.StatusNotFound, ErrorResponse{
				Error: "Page not found. Did you follow the next links?",
				Posts: []Post{},
				Next:  nil,
			})
			return
		}
		writeJSON(w, http.StatusOK, page)
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
