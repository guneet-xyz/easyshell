package submission_poll

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

type request struct {
	ContainerName  string `json:"container_name"`
	OutputFilePath string `json:"output_file_path,omitempty"`
}

// standardOutput is the shape written by the entrypoint's submission mode.
type standardOutput struct {
	Stdout   string            `json:"stdout"`
	Stderr   string            `json:"stderr"`
	ExitCode int               `json:"exit_code"`
	Fs       map[string]string `json:"fs"`
}

type response struct {
	Status string `json:"status"` // "running" or "finished"

	// Only present when status == "finished" and the container was a standard submission.
	Output *standardOutput `json:"output,omitempty"`

	// Only present when status == "finished" and the container was a k3s/live-env submission.
	Score *utils.ScoreResult `json:"score,omitempty"`
}

var validContainerName = utils.ValidContainerName
var validFilePath = regexp.MustCompile(`^/[a-zA-Z0-9/_.-]+$`)

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

	if req.OutputFilePath != "" && !validFilePath.MatchString(req.OutputFilePath) {
		http.Error(w, "Invalid output_file_path", http.StatusBadRequest)
		return
	}

	fmt.Println("Polling submission container:", req.ContainerName)

	// Determine container type from labels
	containerType, err := getContainerLabel(req.ContainerName, "sh.easyshell.type")
	if err != nil {
		// Container doesn't exist — for standard submissions (--rm) this means it finished.
		// Try to read the output file.
		output, readErr := readStandardOutput(req.OutputFilePath)
		if readErr != nil {
			fmt.Printf("Failed to read output for %s: %s\n", req.ContainerName, readErr.Error())
			http.Error(w, "Container not found and no output available: "+readErr.Error(), http.StatusNotFound)
			return
		}

		resp := response{Status: "finished", Output: output}
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode poll response")
		}
		return
	}

	// Check if container is still running
	stateCmd := exec.Command("docker", "inspect", "--format", "{{.State.Status}}", req.ContainerName)
	stateOutput, stateErr := stateCmd.CombinedOutput()
	isRunning := stateErr == nil && strings.TrimSpace(string(stateOutput)) == "running"

	if containerType == "k3s" {
		// K3s/live-env submission: run check.sh if the container is running
		if !isRunning {
			resp := response{Status: "finished", Score: &utils.ScoreResult{
				RawOutput: "Container exited before check could be performed",
			}}
			w.Header().Set("Content-Type", "application/json")
			if json.NewEncoder(w).Encode(resp) != nil {
				fmt.Println("Failed to encode poll response")
			}
			return
		}

		// Run check.sh inside the container
		cmd := exec.Command("docker", "exec",
			"-e", "KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
			req.ContainerName, "bash", "/check.sh")
		output, execErr := cmd.CombinedOutput()
		outputStr := string(output)

		if execErr != nil && len(outputStr) == 0 {
			fmt.Printf("Check failed for %s: %s\n", req.ContainerName, execErr.Error())
			http.Error(w, "Failed to run check: "+execErr.Error(), http.StatusInternalServerError)
			return
		}

		score := utils.ParseScore(outputStr)
		resp := response{Status: "finished", Score: &score}
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode poll response")
		}
		return
	}

	// Standard submission: container uses --rm, so if it's still running we return "running"
	if isRunning {
		resp := response{Status: "running"}
		w.Header().Set("Content-Type", "application/json")
		if json.NewEncoder(w).Encode(resp) != nil {
			fmt.Println("Failed to encode poll response")
		}
		return
	}

	// Standard container finished (and was removed by --rm).
	// Try to read output from the provided file path.
	output, readErr := readStandardOutput(req.OutputFilePath)
	if readErr != nil {
		fmt.Printf("Failed to read output for %s: %s\n", req.ContainerName, readErr.Error())
		http.Error(w, "Container finished but output not available: "+readErr.Error(), http.StatusInternalServerError)
		return
	}

	resp := response{Status: "finished", Output: output}
	w.Header().Set("Content-Type", "application/json")
	if json.NewEncoder(w).Encode(resp) != nil {
		fmt.Println("Failed to encode poll response")
	}
}

// getContainerLabel reads a Docker label value from a container.
func getContainerLabel(containerName, label string) (string, error) {
	cmd := exec.Command("docker", "inspect", "--format", "{{index .Config.Labels \""+label+"\"}}", containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

// readStandardOutput reads the output JSON file written by a standard submission container.
func readStandardOutput(outputFilePath string) (*standardOutput, error) {
	if outputFilePath == "" {
		return nil, fmt.Errorf("no output_file_path provided in poll request")
	}

	data, err := os.ReadFile(outputFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read output file %s: %w", outputFilePath, err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("output file is empty: %s", outputFilePath)
	}

	var output standardOutput
	if err := json.Unmarshal(data, &output); err != nil {
		return nil, fmt.Errorf("failed to parse output from %s: %w", outputFilePath, err)
	}
	return &output, nil
}
