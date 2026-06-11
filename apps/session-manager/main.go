package main

import (
	"fmt"
	"net/http"
	"session-manager/handlers/create"
	"session-manager/handlers/exec"
	is_running "session-manager/handlers/is-running"
	"session-manager/handlers/kill"
	"session-manager/utils"
)

func main() {
	utils.Init()

	http.HandleFunc("/exec", exec.Handler)
	http.HandleFunc("/create", create.Handler)
	http.HandleFunc("/is-running", is_running.Handler)
	http.HandleFunc("/kill", kill.Handler)

	fmt.Println("Listening on port 4000")
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Failed to start server")
	}
}
