package create

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"path"
	"session-manager/utils"
)

type request struct {
	Image         string `json:"image"`
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

	pullPolicy := ""
	if utils.DockerRegistry != "" {
		pullPolicy = "--pull=always"
	}

	containerDir := path.Join(utils.WorkingDir, "sessions", req.ContainerName)
	utils.Mkdirp(containerDir)

	command := fmt.Sprintf("docker run -d --rm --name %s -m 10m --cpus 0.1 -v %s:/tmp/easyshell %s %s/easyshell/%s -mode session", req.ContainerName, containerDir, pullPolicy, utils.DockerRegistry, req.Image)

	fmt.Println("Command: ", command)

	cmd := exec.Command("sh", "-c", command)

	err = cmd.Run()
	if err != nil {
		http.Error(w, "Failed"+err.Error(), http.StatusInternalServerError)
		return
	}
}
