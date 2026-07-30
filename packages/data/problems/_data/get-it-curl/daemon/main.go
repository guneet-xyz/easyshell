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

func mostRecentPost(w http.ResponseWriter, req *http.Request) {
	post := Post{
		Id:      __ID__,
		Content: `__CONTENT__`,
		Author:  `__AUTHOR__`,
	}
	err := json.NewEncoder(w).Encode(post)
	if err != nil {
		panic("Error while encoding json" + err.Error())
	}
}

func main() {
	http.HandleFunc("/most-recent-post", mostRecentPost)
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server" + err.Error())
	}
}
