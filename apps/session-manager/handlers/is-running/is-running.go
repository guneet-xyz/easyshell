package is_running

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"session-manager/utils"
	"strings"
)

type requestBody struct {
	ContainerName string `json:"container_name"`
}

type responseBody struct {
	IsRunning bool `json:"is_running"`
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

	var reqBody requestBody
	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	fmt.Println("Container Name: ", reqBody.ContainerName)

	if !utils.ValidName(reqBody.ContainerName) {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	output, err := exec.Command("docker", "container", "inspect", "--format", "{{.State.Running}}", reqBody.ContainerName).Output()

	var respBody = responseBody{
		IsRunning: err == nil && strings.TrimSpace(string(output)) == "true",
	}

	err = json.NewEncoder(w).Encode(respBody)
	if err != nil {
		http.Error(w, "Failed "+err.Error(), http.StatusInternalServerError)
	}
}
