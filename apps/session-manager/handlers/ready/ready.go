package ready

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"session-manager/utils"
	"strings"
)

type request struct {
	ContainerName string `json:"container_name"`
}

type response struct {
	Ready bool   `json:"ready"`
	Error string `json:"error,omitempty"`
}

var validContainerName = utils.ValidContainerName

// Handler checks whether a container's /tmp/easyshell/ready file exists,
// indicating that the entrypoint (e.g. k3s + setup.sh) has finished.
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

	// Check for error file first
	errCmd := exec.Command("docker", "exec", req.ContainerName, "cat", "/tmp/easyshell/ready.error")
	errOutput, errErr := errCmd.CombinedOutput()
	if errErr == nil {
		// Error file exists — setup failed
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(response{
			Ready: false,
			Error: strings.TrimSpace(string(errOutput)),
		}) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	// Check for ready file
	cmd := exec.Command("docker", "exec", req.ContainerName, "cat", "/tmp/easyshell/ready")
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Neither file exists yet — still starting up
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(response{Ready: false}) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	isReady := strings.TrimSpace(string(output)) == "ready"
	if !isReady {
		fmt.Printf("Unexpected ready file content for %s: %q\n", req.ContainerName, string(output))
	}

	w.Header().Set("Content-Type", "application/json")
	if json.NewEncoder(w).Encode(response{Ready: isReady}) != nil {
		fmt.Println("Failed to encode ready response")
	}
}
