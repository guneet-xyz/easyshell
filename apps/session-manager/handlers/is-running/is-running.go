package is_running

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"session-manager/utils"
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

	command := fmt.Sprintf("docker inspect %s", reqBody.ContainerName)
	cmd := exec.Command("sh", "-c", command)
	err = cmd.Run()

	var respBody = responseBody{
		IsRunning: err == nil,
	}

	err = json.NewEncoder(w).Encode(respBody)
	if err != nil {
		http.Error(w, "Failed "+err.Error(), http.StatusInternalServerError)
	}
}
