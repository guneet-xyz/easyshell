package create

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"path"
	"regexp"
	"session-manager/utils"
)

type request struct {
	Image         string `json:"image"`
	ContainerName string `json:"container_name"`

	// Optional resource configuration for heavier containers (e.g., k3s).
	// If not set, defaults are used (10m memory, 0.1 CPU).
	Memory     string   `json:"memory,omitempty"`     // e.g. "1g", "512m"
	CPU        string   `json:"cpu,omitempty"`        // e.g. "1.0", "0.5"
	Privileged bool     `json:"privileged,omitempty"` // run in privileged mode
	Tmpfs      []string `json:"tmpfs,omitempty"`      // e.g. ["/run", "/var/run"]
	CgroupNs   string   `json:"cgroupns,omitempty"`   // e.g. "private", "host"
	Entrypoint []string `json:"entrypoint,omitempty"` // override entrypoint
	Command    []string `json:"command,omitempty"`    // container command/args (replaces default "-mode session")
}

// validateContainerName ensures the name is safe for use as a Docker container name.
var validContainerName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]+$`)

// validateImageName ensures the image name is safe.
var validImageName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$`)

// validateResourceLimit ensures memory/cpu values are safe.
var validResourceLimit = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?[kmgKMG]?$`)

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

	// Input validation
	if !validContainerName.MatchString(req.ContainerName) {
		http.Error(w, "Invalid container name", http.StatusBadRequest)
		return
	}
	if !validImageName.MatchString(req.Image) {
		http.Error(w, "Invalid image name", http.StatusBadRequest)
		return
	}

	// Determine resource limits (defaults for standard containers)
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

	containerDir := path.Join(utils.WorkingDir, "sessions", req.ContainerName)
	utils.Mkdirp(containerDir)

	var imageTag string
	if utils.DockerRegistry != "" {
		imageTag = utils.DockerRegistry + "/easyshell/" + req.Image
	} else {
		imageTag = req.Image
	}

	// Build docker run args using exec.Command (no shell interpolation)
	args := []string{
		"run", "-q", "-d", "--rm",
		"--name", req.ContainerName,
		"-m", memory,
		"--cpus", cpu,
		"-v", containerDir + ":/tmp/easyshell",
	}

	// Pull policy
	if utils.DockerRegistry != "" {
		args = append(args, "--pull=always")
	}

	// Privileged mode (required for k3s containers)
	if req.Privileged {
		args = append(args, "--privileged")
	}

	// Cgroup namespace
	if req.CgroupNs != "" {
		args = append(args, "--cgroupns="+req.CgroupNs)
	}

	// Tmpfs mounts
	for _, mount := range req.Tmpfs {
		args = append(args, "--tmpfs", mount)
	}

	// Image
	args = append(args, imageTag)

	// Entrypoint override (if specified)
	// Note: when entrypoint is overridden, command args follow the image

	// Command / args (defaults to "-mode session" if not specified)
	if len(req.Command) > 0 {
		args = append(args, req.Command...)
	} else {
		args = append(args, "-mode", "session")
	}

	fmt.Printf("Docker run args: %v\n", args)

	cmd := exec.Command("docker", args...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Command Failed: %s (output: %s)\n", err.Error(), string(output))
		http.Error(w, "Failed to create container: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("Container created: %s\n", req.ContainerName)
	w.WriteHeader(http.StatusOK)
}
