package main

import (
	"encoding/json"
	"net/http"
)

type Post struct {
	Id      int    `json:"id"`
	Content string `json:"content"`
	Author  string `json:"author"`
}

type PostInput struct {
	Content string `json:"content"`
	Author  string `json:"author"`
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

func newPost(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		err := json.NewEncoder(w).Encode(ErrorResponse{
			Status:  "error",
			Message: "Method not allowed",
		})
		if err != nil {
			panic("Error while encoding response" + err.Error())
		}
		return
	}
	var post PostInput
	err := json.NewDecoder(req.Body).Decode(&post)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		err = json.NewEncoder(w).Encode(ErrorResponse{
			Status:  "error",
			Message: "Invalid request body",
		})
		if err != nil {
			panic("Error while encoding response" + err.Error())
		}
		return
	}

	lastPostId := posts[len(posts)-1].Id
	newPost := Post{
		Id:      lastPostId + 1,
		Content: post.Content,
		Author:  post.Author,
	}
	posts = append(posts, newPost)
	err = json.NewEncoder(w).Encode(SuccessResponse{
		Status:  "success",
		Message: "Post created successfully",
		PostId:  newPost.Id,
	})
	if err != nil {
		panic("Error while encoding response" + err.Error())
	}
}

func mostRecentPost(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		err := json.NewEncoder(w).Encode(ErrorResponse{
			Status:  "error",
			Message: "Method not allowed",
		})
		if err != nil {
			panic("Error while encoding response" + err.Error())
		}
		return
	}
	lastPost := posts[len(posts)-1]
	json.NewEncoder(w).Encode(lastPost)
}

func main() {
	http.HandleFunc("/new-post", newPost)
	http.HandleFunc("/most-recent-post", mostRecentPost)
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server" + err.Error())
	}
}
