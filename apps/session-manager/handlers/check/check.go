package check

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"session-manager/utils"
	"strconv"
	"strings"
)

type request struct {
	ContainerName string `json:"container_name"`
}

type response struct {
	Score      int    `json:"score"`
	Total      int    `json:"total"`
	Percentage int    `json:"percentage"`
	Passed     bool   `json:"passed"`
	RawOutput  string `json:"raw_output"`
}

var validContainerName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]+$`)

// scoreRegex matches check.sh score output like "Score: 2/2 (100%)"
var scoreRegex = regexp.MustCompile(`Score:\s*(\d+)/(\d+)\s*\((\d+)%\)`)

// stripAnsi removes ANSI escape codes from a string
var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func stripAnsi(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
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

	fmt.Println("Running check for container:", req.ContainerName)

	// Use docker exec to run check.sh directly in the container.
	// This bypasses the Unix socket / delimiter mechanism entirely,
	// avoiding any I/O interleaving issues with k3s background processes.
	cmd := exec.Command("docker", "exec", req.ContainerName, "bash", "/check.sh")
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

	// Strip ANSI codes for parsing
	cleanOutput := stripAnsi(outputStr)

	// Parse score from output
	matches := scoreRegex.FindStringSubmatch(cleanOutput)

	var resp response
	resp.RawOutput = cleanOutput

	if len(matches) == 4 {
		resp.Score, _ = strconv.Atoi(matches[1])
		resp.Total, _ = strconv.Atoi(matches[2])
		resp.Percentage, _ = strconv.Atoi(matches[3])
		resp.Passed = resp.Score == resp.Total && resp.Total > 0
	} else {
		// Couldn't parse score - check if the output contains any PASS/FAIL lines
		passCount := strings.Count(cleanOutput, "PASS")
		failCount := strings.Count(cleanOutput, "FAIL")
		resp.Score = passCount
		resp.Total = passCount + failCount
		if resp.Total > 0 {
			resp.Percentage = (resp.Score * 100) / resp.Total
		}
		resp.Passed = failCount == 0 && passCount > 0
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if json.NewEncoder(w).Encode(resp) != nil {
		fmt.Println("Failed to encode check response")
	}
}
