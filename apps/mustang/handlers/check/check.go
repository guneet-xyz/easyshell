package check

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

	fmt.Println("Running check for container:", req.ContainerName)

	// Use docker exec to run check.sh directly in the container.
	// This bypasses the Unix socket / delimiter mechanism entirely,
	// avoiding any I/O interleaving issues with k3s background processes.
	// KUBECONFIG must be set for kubectl commands inside check.sh to work.
	cmd := exec.Command("docker", "exec",
		"-e", "KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
		req.ContainerName, "bash", "/check.sh")
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// check.sh may return non-zero when not all checks pass, but that's
	// expected behavior (partial score). We only treat it as a hard error
	// if there is no output at all.
	if err != nil && len(outputStr) == 0 {
		fmt.Printf("Check failed for %s: %s\n", req.ContainerName, err.Error())
		http.Error(w, "Failed to run check: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp := utils.ParseScore(outputStr)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if json.NewEncoder(w).Encode(resp) != nil {
		fmt.Println("Failed to encode check response")
	}
}
