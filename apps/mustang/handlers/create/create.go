package create

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
	Mode     string `json:"mode"` // "session" or "submission"
	Type     string `json:"type"` // "standard" or "k3s"

	// Optional resource configuration for heavier containers (e.g., k3s).
	// If not set, defaults are used (10m memory, 0.1 CPU).
	Memory     string   `json:"memory,omitempty"`     // e.g. "1g", "512m"
	CPU        string   `json:"cpu,omitempty"`        // e.g. "1.0", "0.5"
	Privileged bool     `json:"privileged,omitempty"` // run in privileged mode
	Tmpfs      []string `json:"tmpfs,omitempty"`      // e.g. ["/run", "/var/run"]
	CgroupNs   string   `json:"cgroupns,omitempty"`   // e.g. "private", "host"
	Command    []string `json:"command,omitempty"`    // container command/args (replaces default "-mode session")
}

type response struct {
	ContainerName string `json:"container_name"`
}

// validateImageName ensures the image name is safe.
var validImageName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_./:@-]+$`)

// validateResourceLimit ensures memory/cpu values are safe.
var validResourceLimit = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?[kmgKMG]?$`)

// validateTmpfsPath ensures tmpfs mount paths are safe absolute paths.
var validTmpfsPath = regexp.MustCompile(`^/[a-zA-Z0-9/_.-]+$`)

// allowedCgroupNs is the set of valid values for --cgroupns.
var allowedCgroupNs = map[string]bool{"private": true, "host": true}

// allowedModes is the set of valid container modes.
var allowedModes = map[string]bool{"session": true, "submission": true, "warm": true}

// allowedTypes is the set of valid container types.
var allowedTypes = map[string]bool{"standard": true, "k3s": true}

// validProblemSlug ensures the problem slug is safe for use in labels.
var validProblemSlug = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)

// validCommandArg ensures each command/arg element contains only safe characters.
// Allows single-hyphen flags (e.g. "-mode") used by container entrypoints, but
// double-hyphen Docker flags (e.g. "--privileged", "--volume") are blocked separately
// via a strings.HasPrefix check before this regex is applied.
var validCommandArg = regexp.MustCompile(`^[a-zA-Z0-9-][a-zA-Z0-9_./:@=-]*$`)

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
	if !validImageName.MatchString(req.Image) {
		http.Error(w, "Invalid image name", http.StatusBadRequest)
		return
	}
	if req.Problem == "" || !validProblemSlug.MatchString(req.Problem) {
		http.Error(w, "Invalid problem slug", http.StatusBadRequest)
		return
	}
	if !allowedModes[req.Mode] {
		http.Error(w, "Invalid mode (must be 'session' or 'submission')", http.StatusBadRequest)
		return
	}
	if !allowedTypes[req.Type] {
		http.Error(w, "Invalid type (must be 'standard' or 'k3s')", http.StatusBadRequest)
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

	// Generate container name server-side
	containerName := utils.GenerateContainerName()

	containerDir := path.Join(utils.WorkingDir, "sessions", containerName)
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
		"--name", containerName,
		"-m", memory,
		"--memory-swap", memory, // equal to -m to disable swap
		"--cpus", cpu,
		"-v", containerDir + ":/tmp/easyshell",
		// Docker labels for metadata
		"--label", "sh.easyshell.problem=" + req.Problem,
		"--label", "sh.easyshell.testcase=" + strconv.Itoa(req.Testcase),
		"--label", "sh.easyshell.mode=" + req.Mode,
		"--label", "sh.easyshell.type=" + req.Type,
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
		if !allowedCgroupNs[req.CgroupNs] {
			http.Error(w, "Invalid cgroupns value (must be 'private' or 'host')", http.StatusBadRequest)
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

	// Validate command args before use
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

	// Image
	args = append(args, imageTag)

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

	fmt.Printf("Container created: %s\n", containerName)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if json.NewEncoder(w).Encode(response{ContainerName: containerName}) != nil {
		fmt.Println("Failed to encode create response")
	}
}
