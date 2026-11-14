package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
)

//go:embed data.json
var dataJSON []byte

const target = "Melon Usk"

type Post struct {
	Id      int    `json:"id"`
	Author  string `json:"author"`
	Content string `json:"content"`
}

type Data struct {
	Posts       []Post `json:"posts"`
	Certificate string `json:"certificate"`
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type DeleteResponse struct {
	Status string `json:"status"`
	Id     int    `json:"id"`
}

type ClearanceResponse struct {
	Cleared        bool    `json:"cleared"`
	RemainingPosts int     `json:"remaining_posts"`
	Certificate    *string `json:"certificate"`
	Message        string  `json:"message"`
}

var (
	data Data
	// Posts that are still up, in their original order.
	posts           []Post
	innocentDeleted = 0
	mu              sync.Mutex
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

func listPosts(w http.ResponseWriter, req *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	writeJSON(w, http.StatusOK, posts)
}

func handlePost(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.Atoi(req.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Post IDs are numbers.")
		return
	}

	mu.Lock()
	defer mu.Unlock()

	index := -1
	for i, post := range posts {
		if post.Id == id {
			index = i
		}
	}

	switch req.Method {
	case http.MethodGet:
		if index == -1 {
			writeError(w, http.StatusNotFound, "Post not found.")
			return
		}
		writeJSON(w, http.StatusOK, posts[index])
	case http.MethodDelete:
		if index == -1 {
			writeError(w, http.StatusNotFound, "Post not found. Already deleted?")
			return
		}
		if posts[index].Author != target {
			innocentDeleted++
		}
		posts = append(posts[:index], posts[index+1:]...)
		writeJSON(w, http.StatusOK, DeleteResponse{Status: "deleted", Id: id})
	default:
		w.Header().Set("Allow", "GET, DELETE")
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed. Posts can be read (GET) or deleted (DELETE).")
	}
}

func clearance(w http.ResponseWriter, req *http.Request) {
	mu.Lock()
	defer mu.Unlock()

	left := 0
	for _, post := range posts {
		if post.Author == target {
			left++
		}
	}

	response := ClearanceResponse{
		Cleared:        false,
		RemainingPosts: len(posts),
		Certificate:    nil,
	}
	switch {
	case innocentDeleted > 0:
		response.Message = fmt.Sprintf("You deleted %d post(s) that were not by %s. Legal is now preparing a lawsuit against you.", innocentDeleted, target)
	case left > 0:
		response.Message = fmt.Sprintf("%d post(s) by %s are still up. Legal is hyperventilating.", left, target)
	default:
		response.Cleared = true
		response.Certificate = &data.Certificate
		response.Message = "All clear. Legal can finally go to sleep."
	}
	writeJSON(w, http.StatusOK, response)
}

func main() {
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}
	posts = append([]Post{}, data.Posts...)

	http.HandleFunc("/posts", listPosts)
	http.HandleFunc("/posts/{id}", handlePost)
	http.HandleFunc("/legal/clearance", clearance)

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
