package kill

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os/exec"
)

type request struct {
	ContainerName string `json:"container_name"`
}

var validContainerName = utils.ValidContainerName

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

	if !validContainerName.MatchString(req.ContainerName) {
		http.Error(w, "Invalid container name", http.StatusBadRequest)
		return
	}

	fmt.Println("Removing container:", req.ContainerName)

	// Use "docker rm -f" instead of "docker kill" so it works on both
	// running and stopped/exited containers.
	cmd := exec.Command("docker", "rm", "-f", req.ContainerName)
	err = cmd.Run()
	if err != nil {
		http.Error(w, "Failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
