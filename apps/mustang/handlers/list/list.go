package list

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os"
	"os/exec"
	"path"
	"strings"
)

type container struct {
	Name      string            `json:"name"`
	Labels    map[string]string `json:"labels"`
	CreatedAt string            `json:"created_at"`
	Status    string            `json:"status"`
}

type response struct {
	Containers []container `json:"containers"`
}

// dockerContainer is the JSON structure returned by docker ps --format json.
type dockerContainer struct {
	Names     string `json:"Names"`
	Labels    string `json:"Labels"`
	CreatedAt string `json:"CreatedAt"`
	Status    string `json:"Status"`
}

// parseLabels parses a Docker label string like "key1=val1,key2=val2" into a map.
func parseLabels(labelStr string) map[string]string {
	labels := make(map[string]string)
	if labelStr == "" {
		return labels
	}
	for _, pair := range strings.Split(labelStr, ",") {
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) == 2 {
			labels[parts[0]] = parts[1]
		}
	}
	return labels
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+utils.Token {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	// Optional query param filters
	filterMode := r.URL.Query().Get("mode")
	filterProblem := r.URL.Query().Get("problem")
	filterTestcase := r.URL.Query().Get("testcase")

	// List all easyshell containers (running only)
	args := []string{
		"ps",
		"--filter", "label=sh.easyshell.problem",
		"--format", "{{json .}}",
		"--no-trunc",
	}

	cmd := exec.Command("docker", args...)
	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("docker ps failed: %s\n", err.Error())
		http.Error(w, "Failed to list containers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var containers []container
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		var dc dockerContainer
		if err := json.Unmarshal([]byte(line), &dc); err != nil {
			fmt.Printf("Failed to parse docker ps line: %s (err: %s)\n", line, err.Error())
			continue
		}

		labels := parseLabels(dc.Labels)

		// Apply filters
		if filterMode != "" && labels["sh.easyshell.mode"] != filterMode {
			continue
		}
		if filterProblem != "" && labels["sh.easyshell.problem"] != filterProblem {
			continue
		}
		if filterTestcase != "" && labels["sh.easyshell.testcase"] != filterTestcase {
			continue
		}

		// When filtering for mode=warm, exclude containers that have been claimed.
		// A claimed container has a "claimed" marker file in its working directory.
		if filterMode == "warm" && labels["sh.easyshell.mode"] == "warm" {
			claimMarker := path.Join(utils.WorkingDir, "sessions", dc.Names, "claimed")
			if _, err := os.Stat(claimMarker); err == nil {
				// Container has been claimed, skip it
				continue
			}
		}

		containers = append(containers, container{
			Name:      dc.Names,
			Labels:    labels,
			CreatedAt: dc.CreatedAt,
			Status:    dc.Status,
		})
	}

	if containers == nil {
		containers = []container{}
	}

	resp := response{Containers: containers}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		fmt.Println("Failed to encode list response:", err)
	}
}
