package claim

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os/exec"
	"strings"
	"sync"
)

type request struct {
	ContainerName string `json:"container_name"`
}

type response struct {
	Claimed bool   `json:"claimed"`
	Error   string `json:"error,omitempty"`
}

var validContainerName = utils.ValidContainerName

// claimMu serializes all claim operations to prevent race conditions.
// Even though Go's HTTP server handles requests concurrently, we ensure
// that only one claim can be processed at a time.
var claimMu sync.Mutex

// getContainerLabel runs docker inspect to get a specific label value.
func getContainerLabel(containerName, labelKey string) (string, error) {
	cmd := exec.Command("docker", "inspect",
		"--format", fmt.Sprintf("{{index .Config.Labels %q}}", labelKey),
		containerName,
	)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
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

	if !validContainerName.MatchString(req.ContainerName) {
		http.Error(w, "Invalid container name", http.StatusBadRequest)
		return
	}

	// Serialize claim operations to prevent two requests from claiming
	// the same container simultaneously.
	claimMu.Lock()
	defer claimMu.Unlock()

	// Verify the container exists and has mode=warm label
	mode, err := getContainerLabel(req.ContainerName, "sh.easyshell.mode")
	if err != nil {
		fmt.Printf("Claim failed: container %s not found: %s\n", req.ContainerName, err.Error())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if json.NewEncoder(w).Encode(response{Claimed: false, Error: "container not found"}) != nil {
			fmt.Println("Failed to encode claim response")
		}
		return
	}

	if mode != "warm" {
		fmt.Printf("Claim failed: container %s has mode=%s (expected warm)\n", req.ContainerName, mode)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if json.NewEncoder(w).Encode(response{Claimed: false, Error: "container is not a warm instance"}) != nil {
			fmt.Println("Failed to encode claim response")
		}
		return
	}

	// Relabel the container from warm to session.
	// Docker doesn't support changing labels on a running container directly,
	// so we use a convention: we mark it as claimed by adding a "claimed" label.
	// The list endpoint filters by mode=warm, so claimed containers won't be
	// returned as available warm containers.
	//
	// We use docker exec to write a marker file, and the list endpoint uses
	// docker inspect labels. Since we can't change labels, we stop the container
	// and restart with new labels... but that's disruptive.
	//
	// Simpler approach: use the container's filesystem as a claim marker.
	// Write /tmp/easyshell/claimed to mark the container as claimed.
	// The list endpoint will check for this file to exclude claimed containers.
	//
	// Actually, the simplest approach: just remove the warm filter from the
	// container listing by convention. Once a container is claimed, the cron
	// service will see one fewer warm container and create a replacement.
	// We track claims by the fact that the cron service's list count changes.
	//
	// Best approach: Since Docker labels are immutable on running containers,
	// we'll use a file-based claim marker in the shared volume.
	claimMarkerDir := fmt.Sprintf("%s/sessions/%s", utils.WorkingDir, req.ContainerName)
	utils.Mkdirp(claimMarkerDir)

	// Write a claim marker file. This is checked by the list endpoint filter.
	claimMarkerPath := fmt.Sprintf("%s/claimed", claimMarkerDir)
	cmd := exec.Command("touch", claimMarkerPath)
	if err := cmd.Run(); err != nil {
		fmt.Printf("Claim failed: could not write claim marker for %s: %s\n", req.ContainerName, err.Error())
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		if json.NewEncoder(w).Encode(response{Claimed: false, Error: "failed to write claim marker"}) != nil {
			fmt.Println("Failed to encode claim response")
		}
		return
	}

	fmt.Printf("Container claimed: %s\n", req.ContainerName)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response{Claimed: true})
}
