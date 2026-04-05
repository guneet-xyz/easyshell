package main

import (
	"fmt"
	"mustang/handlers/check"
	"mustang/handlers/claim"
	"mustang/handlers/create"
	"mustang/handlers/exec"
	"mustang/handlers/kill"
	"mustang/handlers/list"
	"mustang/handlers/ready"
	exec_stream "mustang/handlers/session/exec_stream"
	submission_create "mustang/handlers/submission/create"
	submission_poll "mustang/handlers/submission/poll"
	"mustang/utils"
	"net/http"
)

func main() {
	utils.Init()

	// Session endpoints
	http.HandleFunc("/session/create", create.Handler)
	http.HandleFunc("/session/ready", ready.Handler)
	http.HandleFunc("/session/exec", func(w http.ResponseWriter, r *http.Request) {
		// Route GET to SSE stream, POST to regular exec
		if r.Method == "GET" {
			exec_stream.Handler(w, r)
		} else {
			exec.Handler(w, r)
		}
	})
	http.HandleFunc("/session/kill", kill.Handler)
	http.HandleFunc("/session/check", check.Handler)

	// Submission endpoints
	http.HandleFunc("/submission/create", submission_create.Handler)
	http.HandleFunc("/submission/poll", submission_poll.Handler)

	// Container management endpoints
	http.HandleFunc("/containers/list", list.Handler)
	http.HandleFunc("/session/claim", claim.Handler)

	fmt.Println("Listening on port 4000")
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Failed to start server")
	}
}
