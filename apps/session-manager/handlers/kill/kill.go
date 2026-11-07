package kill

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"session-manager/utils"
)

type request struct {
	ContainerName string `json:"container_name"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+utils.Token {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req request
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if !utils.ValidName(req.ContainerName) {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	fmt.Println("Killing session container:", req.ContainerName)

	err = exec.Command("docker", "container", "kill", req.ContainerName).Run()
	if err != nil {
		http.Error(w, "Failed"+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
