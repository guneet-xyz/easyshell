package create

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path"
	"session-manager/utils"
	"strconv"
	"time"
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

	if !utils.ValidName(req.Image) || !utils.ValidName(req.ContainerName) {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	containerDir := path.Join(utils.WorkingDir, "sessions", req.ContainerName)
	utils.Mkdirp(containerDir)
	// Writable by remapped (user-namespaced) root in the session container.
	if err := os.Chmod(containerDir, 0o777); err != nil {
		http.Error(w, "Failed to prepare session directory", http.StatusInternalServerError)
		return
	}

	imageTag := req.Image
	if utils.DockerRegistry != "" {
		imageTag = utils.DockerRegistry + "/easyshell/" + req.Image
	}

	expires := time.Now().Add(utils.SessionLifetime).Unix()
	args := []string{"run", "-q", "-d", "--rm", "--name", req.ContainerName,
		"--label", "easyshell.session=1",
		"--label", "easyshell.expires=" + strconv.FormatInt(expires, 10),
		"--network", "none", "--pids-limit", "256", "-m", "10m", "--cpus", "0.1",
		"-v", containerDir + ":/tmp/easyshell"}
	if utils.DockerRegistry != "" {
		args = append(args, "--pull=always")
	}
	args = append(args, imageTag, "-mode", "session")

	fmt.Println("Creating session container:", req.ContainerName)

	output, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		fmt.Printf("Command Failed : %s\n", string(output))
		http.Error(w, "Failed to create session container", http.StatusInternalServerError)
		return
	}
}
