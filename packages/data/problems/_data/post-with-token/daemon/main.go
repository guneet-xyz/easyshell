package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

const TOKEN = `__TOKEN__`

type Post struct {
	Id      int    `json:"id"`
	Content string `json:"content"`
	Author  string `json:"author"`
}

type PostInput struct {
	Content string `json:"content"`
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type SuccessResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	PostId  int    `json:"post_id"`
}

var posts = []Post{
	{
		Id:      __ID__,
		Content: `__CONTENT__`,
		Author:  `__AUTHOR__`,
	},
}

func WriteResponse(w http.ResponseWriter, status int, object interface{}) {
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(object)
	if err != nil {
		panic("Error while encoding response" + err.Error())
	}
}

func IsAuthorized(w http.ResponseWriter, req *http.Request) bool {
	token_header := req.Header.Get("Authorization")
	if !strings.HasPrefix(token_header, "Bearer ") {
		WriteResponse(w, http.StatusUnauthorized, ErrorResponse{
			Status:  "error",
			Message: "Unauthorized",
		})
		return false
	}

	token := strings.TrimPrefix(token_header, "Bearer ")
	if token != TOKEN {
		WriteResponse(w, http.StatusUnauthorized, ErrorResponse{
			Status:  "error",
			Message: "Unauthorized",
		})
		return false
	}
	return true
}

func newPost(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		WriteResponse(w, http.StatusMethodNotAllowed, ErrorResponse{
			Status:  "error",
			Message: "Method not allowed",
		})
		return
	}

	if !IsAuthorized(w, req) {
		return
	}

	var post PostInput
	err := json.NewDecoder(req.Body).Decode(&post)
	if err != nil {
		WriteResponse(w, http.StatusBadRequest, ErrorResponse{
			Status:  "error",
			Message: "Invalid request body",
		})
		return
	}

	lastPostId := posts[len(posts)-1].Id
	newPost := Post{
		Id:      lastPostId + 1,
		Content: post.Content,
		Author:  "easyshell-user",
	}
	posts = append(posts, newPost)

	WriteResponse(w, http.StatusCreated, SuccessResponse{
		Status:  "success",
		Message: "Post created successfully",
		PostId:  newPost.Id,
	})
}

func mostRecentPost(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		WriteResponse(w, http.StatusMethodNotAllowed, ErrorResponse{
			Status:  "error",
			Message: "Method not allowed",
		})
		return
	}

	if !IsAuthorized(w, req) {
		return
	}

	lastPost := posts[len(posts)-1]
	WriteResponse(w, http.StatusOK, lastPost)
}

func main() {
	http.HandleFunc("/new-post", newPost)
	http.HandleFunc("/most-recent-post", mostRecentPost)
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server" + err.Error())
	}
}
