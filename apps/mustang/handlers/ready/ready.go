package ready

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os/exec"
	"strings"
)

type response struct {
	Exists  bool   `json:"exists"`
	Running bool   `json:"running"`
	Ready   bool   `json:"ready"`
	Error   string `json:"error,omitempty"`
}

var validContainerName = utils.ValidContainerName

// Handler checks container liveness and readiness.
// GET /session/ready?name=<containerName>
//
// Response fields:
//   - exists:  whether the container exists at all (docker inspect succeeds)
//   - running: whether the container is in "running" state
//   - ready:   whether /tmp/easyshell/ready contains "ready" (k3s setup done)
//   - error:   content of /tmp/easyshell/ready.error if setup failed
func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+utils.Token {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	containerName := r.URL.Query().Get("name")
	if containerName == "" || !validContainerName.MatchString(containerName) {
		http.Error(w, "Invalid or missing container name", http.StatusBadRequest)
		return
	}

	resp := response{}

	// Check if container exists and get its state
	inspectCmd := exec.Command("docker", "inspect", "--format", "{{.State.Status}}", containerName)
	inspectOutput, err := inspectCmd.CombinedOutput()
	if err != nil {
		// Container doesn't exist
		resp.Exists = false
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	resp.Exists = true
	state := strings.TrimSpace(string(inspectOutput))
	resp.Running = state == "running"

	if !resp.Running {
		// Container exists but isn't running — no point checking readiness
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	// Check for error file first
	errCmd := exec.Command("docker", "exec", containerName, "cat", "/tmp/easyshell/ready.error")
	errOutput, errErr := errCmd.CombinedOutput()
	if errErr == nil {
		// Error file exists — setup failed
		resp.Error = strings.TrimSpace(string(errOutput))
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	// Check for ready file
	readyCmd := exec.Command("docker", "exec", containerName, "cat", "/tmp/easyshell/ready")
	readyOutput, readyErr := readyCmd.CombinedOutput()
	if readyErr != nil {
		// Neither file exists yet — still starting up
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode ready response")
		}
		return
	}

	isReady := strings.TrimSpace(string(readyOutput)) == "ready"
	if !isReady {
		fmt.Printf("Unexpected ready file content for %s: %q\n", containerName, string(readyOutput))
	}
	resp.Ready = isReady

	w.Header().Set("Content-Type", "application/json")
	if json.NewEncoder(w).Encode(resp) != nil {
		fmt.Println("Failed to encode ready response")
	}
}
