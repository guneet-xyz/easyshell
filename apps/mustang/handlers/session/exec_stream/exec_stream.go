package exec_stream

import (
	"bufio"
	"fmt"
	"mustang/utils"
	"net/http"
	osexec "os/exec"
	"path"
	"strings"
)

var validContainerName = utils.ValidContainerName

// Handler streams command execution output via Server-Sent Events.
// GET /session/exec?name=<containerName>&command=<command>
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
	command := r.URL.Query().Get("command")

	if containerName == "" || !validContainerName.MatchString(containerName) {
		http.Error(w, "Invalid or missing container name", http.StatusBadRequest)
		return
	}
	if command == "" {
		http.Error(w, "Missing command", http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	fmt.Printf("SSE exec - Container: %s, Command: %s\n", containerName, command)

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	// Send command to the container via Unix socket (same mechanism as POST /session/exec)
	socketPath := path.Join(utils.WorkingDir, "sessions", containerName, "main.sock")

	// Ensure the socket is accessible — the container creates it as root,
	// so chmod it from inside the container where we have root permissions.
	chmodCmd := osexec.Command("docker", "exec", containerName, "chmod", "0777", "/tmp/easyshell/main.sock")
	if out, err := chmodCmd.CombinedOutput(); err != nil {
		fmt.Printf("Warning: failed to chmod socket in %s: %s (%s)\n", containerName, err, string(out))
	}

	client := utils.SocketClient(socketPath)

	req, err := http.NewRequest("POST", "http://localhost/whatever", strings.NewReader(command))
	if err != nil {
		writeSSEEvent(w, flusher, "error", fmt.Sprintf(`{"message":"Failed to construct request: %s"}`, err.Error()))
		writeSSEEvent(w, flusher, "done", "{}")
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		writeSSEEvent(w, flusher, "error", fmt.Sprintf(`{"message":"Request failed, container might be down: %s"}`, err.Error()))
		writeSSEEvent(w, flusher, "done", "{}")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusLocked {
		writeSSEEvent(w, flusher, "error", `{"message":"Container is locked (running another command)"}`)
		writeSSEEvent(w, flusher, "done", "{}")
		return
	}

	if resp.StatusCode != http.StatusOK {
		writeSSEEvent(w, flusher, "error", fmt.Sprintf(`{"message":"Container error (status %d)"}`, resp.StatusCode))
		writeSSEEvent(w, flusher, "done", "{}")
		return
	}

	// Stream the response body line by line as SSE events
	scanner := bufio.NewScanner(resp.Body)
	// Allow up to 1MB per line
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		writeSSEEvent(w, flusher, "stdout", line)
	}

	if err := scanner.Err(); err != nil {
		writeSSEEvent(w, flusher, "error", fmt.Sprintf(`{"message":"Read error: %s"}`, err.Error()))
	}

	writeSSEEvent(w, flusher, "done", "{}")
}

func writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, eventType string, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, data)
	flusher.Flush()
}
