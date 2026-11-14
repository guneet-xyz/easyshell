package main

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

//go:embed data.json
var dataJSON []byte

type StoredPost struct {
	Id       int    `json:"id"`
	Author   string `json:"author"`
	Content  string `json:"content"`
	Revision int    `json:"revision"`
}

type Data struct {
	Token string        `json:"token"`
	Posts []*StoredPost `json:"posts"`
}

type Post struct {
	Id       int    `json:"id"`
	Author   string `json:"author"`
	Content  string `json:"content"`
	Revision string `json:"revision"`
}

type PostInput struct {
	Content *string `json:"content"`
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

var (
	data Data
	mu   sync.Mutex
)

func writeJSON(w http.ResponseWriter, status int, object interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(object); err != nil {
		panic("Error while encoding response: " + err.Error())
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, ErrorResponse{Status: "error", Message: message})
}

// Revisions look like CouchDB's: "<number of edits>-<hash of the content>".
func revision(post *StoredPost) string {
	hash := sha256.Sum256([]byte(post.Content))
	return fmt.Sprintf("%d-%s", post.Revision, hex.EncodeToString(hash[:])[:8])
}

func view(post *StoredPost) Post {
	return Post{
		Id:       post.Id,
		Author:   post.Author,
		Content:  post.Content,
		Revision: revision(post),
	}
}

func isAuthorized(req *http.Request) bool {
	header := req.Header.Get("Authorization")
	return strings.HasPrefix(header, "Bearer ") &&
		strings.TrimPrefix(header, "Bearer ") == data.Token
}

func handlePost(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(req.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Post IDs are numbers.")
		return
	}

	mu.Lock()
	defer mu.Unlock()

	var post *StoredPost
	for _, candidate := range data.Posts {
		if candidate.Id == id {
			post = candidate
		}
	}

	switch req.Method {
	case http.MethodGet:
		if post == nil {
			writeError(w, http.StatusNotFound, "Post not found.")
			return
		}
		writeJSON(w, http.StatusOK, view(post))
	case http.MethodPut:
		if !isAuthorized(req) {
			writeError(w, http.StatusUnauthorized, "Unauthorized. Where's your bearer token?")
			return
		}
		if post == nil {
			writeError(w, http.StatusNotFound, "Post not found.")
			return
		}
		var input PostInput
		if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
			return
		}
		if input.Content == nil {
			writeError(w, http.StatusBadRequest, `The JSON body needs a "content" field.`)
			return
		}
		post.Content = *input.Content
		post.Revision++
		writeJSON(w, http.StatusOK, view(post))
	default:
		w.Header().Set("Allow", "GET, PUT")
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed. Posts can be read (GET) or replaced (PUT).")
	}
}

func main() {
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/posts", func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		posts := []Post{}
		for _, post := range data.Posts {
			posts = append(posts, view(post))
		}
		writeJSON(w, http.StatusOK, posts)
	})
	http.HandleFunc("/posts/{id}", handlePost)

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
