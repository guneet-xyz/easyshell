package submission_create

import (
	"encoding/json"
	"fmt"
	"mustang/utils"
	"net/http"
	"os/exec"
	"path"
	"regexp"
	"strconv"
	"strings"
)

type request struct {
	Image   string `json:"image"`
	Problem string `json:"problem"`
	// Testcase number. Defaults to 0 if omitted.
	Testcase int    `json:"testcase"`
	Type     string `json:"type"` // "standard" or "k3s"

	// File paths for standard submission I/O (host paths, mounted into the container).
	InputFilePath  string `json:"input_file_path,omitempty"`
	OutputFilePath string `json:"output_file_path,omitempty"`

	// Optional resource overrides (same as session/create).
	Memory     string   `json:"memory,omitempty"`
	CPU        string   `json:"cpu,omitempty"`
	Privileged bool     `json:"privileged,omitempty"`
	Tmpfs      []string `json:"tmpfs,omitempty"`
	CgroupNs   string   `json:"cgroupns,omitempty"`
	Command    []string `json:"command,omitempty"`
}

type response struct {
	ContainerName string `json:"container_name"`
}

var validImageName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$`)
var validResourceLimit = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?[kmgKMG]?$`)
var validTmpfsPath = regexp.MustCompile(`^/[a-zA-Z0-9/_.-]+$`)
var validProblemSlug = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)
var validFilePath = regexp.MustCompile(`^/[a-zA-Z0-9/_.-]+$`)
var validCommandArg = regexp.MustCompile(`^[a-zA-Z0-9-][a-zA-Z0-9_./:@=-]*$`)

var allowedCgroupNs = map[string]bool{"private": true, "host": true}
var allowedTypes = map[string]bool{"standard": true, "k3s": true}

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

	// Validate inputs
	if !validImageName.MatchString(req.Image) {
		http.Error(w, "Invalid image name", http.StatusBadRequest)
		return
	}
	if req.Problem == "" || !validProblemSlug.MatchString(req.Problem) {
		http.Error(w, "Invalid problem slug", http.StatusBadRequest)
		return
	}
	if !allowedTypes[req.Type] {
		http.Error(w, "Invalid type (must be 'standard' or 'k3s')", http.StatusBadRequest)
		return
	}

	// For standard submissions, input and output file paths are required
	if req.Type == "standard" {
		if req.InputFilePath == "" || !validFilePath.MatchString(req.InputFilePath) {
			http.Error(w, "Invalid or missing input_file_path", http.StatusBadRequest)
			return
		}
		if req.OutputFilePath == "" || !validFilePath.MatchString(req.OutputFilePath) {
			http.Error(w, "Invalid or missing output_file_path", http.StatusBadRequest)
			return
		}
	}

	containerName := utils.GenerateContainerName()

	var imageTag string
	if utils.DockerRegistry != "" {
		imageTag = utils.DockerRegistry + "/easyshell/" + req.Image
	} else {
		imageTag = req.Image
	}

	// Resource defaults
	memory := "10m"
	cpu := "0.1"
	if req.Memory != "" {
		if !validResourceLimit.MatchString(req.Memory) {
			http.Error(w, "Invalid memory value", http.StatusBadRequest)
			return
		}
		memory = req.Memory
	}
	if req.CPU != "" {
		if !validResourceLimit.MatchString(req.CPU) {
			http.Error(w, "Invalid cpu value", http.StatusBadRequest)
			return
		}
		cpu = req.CPU
	}

	// Validate command args
	for _, arg := range req.Command {
		if strings.HasPrefix(arg, "--") {
			http.Error(w, "Docker flags are not allowed in command arguments", http.StatusBadRequest)
			return
		}
		if !validCommandArg.MatchString(arg) {
			http.Error(w, "Invalid command argument", http.StatusBadRequest)
			return
		}
	}

	var args []string

	if req.Type == "standard" {
		// Standard submission: short-lived container with --rm, mounts input/output
		args = []string{
			"run", "-q", "-d", "--rm",
			"--name", containerName,
			"-m", memory,
			"--memory-swap", memory,
			"--cpus", cpu,
			"-v", req.InputFilePath + ":/input.sh",
			"-v", req.OutputFilePath + ":/output.json",
			"--label", "sh.easyshell.problem=" + req.Problem,
			"--label", "sh.easyshell.testcase=" + strconv.Itoa(req.Testcase),
			"--label", "sh.easyshell.mode=submission",
			"--label", "sh.easyshell.type=" + req.Type,
		}
	} else {
		// K3s submission: long-running container, needs easyshell volume for socket/ready files
		containerDir := path.Join(utils.WorkingDir, "sessions", containerName)
		utils.Mkdirp(containerDir)

		args = []string{
			"run", "-q", "-d",
			"--name", containerName,
			"-m", memory,
			"--memory-swap", memory,
			"--cpus", cpu,
			"-v", containerDir + ":/tmp/easyshell",
			"--label", "sh.easyshell.problem=" + req.Problem,
			"--label", "sh.easyshell.testcase=" + strconv.Itoa(req.Testcase),
			"--label", "sh.easyshell.mode=submission",
			"--label", "sh.easyshell.type=" + req.Type,
		}
	}

	// Pull policy
	if utils.DockerRegistry != "" {
		args = append(args, "--pull=always")
	}

	// Privileged mode
	if req.Privileged {
		args = append(args, "--privileged")
	}

	// Cgroup namespace
	if req.CgroupNs != "" {
		if !allowedCgroupNs[req.CgroupNs] {
			http.Error(w, "Invalid cgroupns value", http.StatusBadRequest)
			return
		}
		args = append(args, "--cgroupns="+req.CgroupNs)
	}

	// Tmpfs mounts
	for _, mount := range req.Tmpfs {
		if !validTmpfsPath.MatchString(mount) {
			http.Error(w, "Invalid tmpfs path", http.StatusBadRequest)
			return
		}
		args = append(args, "--tmpfs", mount)
	}

	// Image
	args = append(args, imageTag)

	// Command
	if len(req.Command) > 0 {
		args = append(args, req.Command...)
	} else {
		args = append(args, "-mode", "submission")
	}

	fmt.Printf("Submission docker run args: %v\n", args)

	cmd := exec.Command("docker", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("Submission create failed: %s (output: %s)\n", err.Error(), string(output))
		http.Error(w, "Failed to create submission container: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("Submission container created: %s\n", containerName)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if json.NewEncoder(w).Encode(response{ContainerName: containerName}) != nil {
		fmt.Println("Failed to encode submission create response")
	}
}
