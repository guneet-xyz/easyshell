package main

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"strings"
)

//go:embed data.json
var dataJSON []byte

type Post struct {
	Id      int    `json:"id"`
	Author  string `json:"author"`
	Content string `json:"content"`
}

type Data struct {
	Posts []Post `json:"posts"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type SearchResponse struct {
	Query   string `json:"query"`
	Count   int    `json:"count"`
	Results []Post `json:"results"`
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

	http.HandleFunc("/search", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{
				Error: "Method not allowed. Searching is a GET thing.",
			})
			return
		}

		// Malformed escapes like a lone "%" make the whole parameter invalid.
		query := req.URL.Query().Get("q")
		if query == "" {
			writeJSON(w, http.StatusBadRequest, ErrorResponse{
				Error: "Missing or empty query parameter q. What are we even searching for?",
			})
			return
		}

		results := []Post{}
		for _, post := range data.Posts {
			if strings.Contains(post.Content, query) {
				results = append(results, post)
			}
		}

		writeJSON(w, http.StatusOK, SearchResponse{
			Query:   query,
			Count:   len(results),
			Results: results,
		})
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
