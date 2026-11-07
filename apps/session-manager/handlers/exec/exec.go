package exec

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"path"
	"session-manager/utils"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	execTimeout      = 15 * time.Second
	maxResponseBytes = 1 << 20
)

type requestBody struct {
	ContainerName string `json:"container_name"`
	Command       string `json:"command"`
}

type ErrorResponse struct {
	Critical bool   `json:"critical"`
	Message  string `json:"message"`
	Error    string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, body ErrorResponse) {
	w.WriteHeader(status)
	if json.NewEncoder(w).Encode(body) != nil {
		panic("couldn't write error response")
	}
}

// dialSessionSocket connects to the session's main.sock without following a
// symlink. The session directory is writable from inside the user's container,
// so the file is opened O_PATH|O_NOFOLLOW, checked to be a socket, and dialed
// through /proc/self/fd. Swapping the file after the check cannot redirect us.
func dialSessionSocket(socketPath string) (net.Conn, error) {
	fd, err := syscall.Open(socketPath, syscall.O_PATH|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	defer syscall.Close(fd)

	var stat syscall.Stat_t
	if err := syscall.Fstat(fd, &stat); err != nil {
		return nil, err
	}
	if stat.Mode&syscall.S_IFMT != syscall.S_IFSOCK {
		return nil, fmt.Errorf("not a socket")
	}
	return net.Dial("unix", "/proc/self/fd/"+strconv.Itoa(fd))
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

	var reqBody requestBody
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	if !utils.ValidName(reqBody.ContainerName) {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	socketPath := path.Join(utils.WorkingDir, "sessions", reqBody.ContainerName, "main.sock")

	ctx, cancel := context.WithTimeout(r.Context(), execTimeout)
	defer cancel()

	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(context.Context, string, string) (net.Conn, error) {
				return dialSessionSocket(socketPath)
			},
		},
	}

	// The URL is irrelevant: the transport always dials the session socket.
	req, err := http.NewRequestWithContext(ctx, "POST", "http://localhost/whatever", strings.NewReader(reqBody.Command))
	if err != nil {
		writeError(w, http.StatusInternalServerError, ErrorResponse{Critical: true, Message: "couldn't construct request", Error: err.Error()})
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Exec failed for", reqBody.ContainerName)
		writeError(w, http.StatusInternalServerError, ErrorResponse{Critical: true, Message: "request failed, container might be down", Error: "session unavailable"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		writeError(w, http.StatusInternalServerError, ErrorResponse{Critical: true, Message: "couldn't read response body", Error: err.Error()})
		return
	}

	switch resp.StatusCode {
	case http.StatusOK:
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(body); err != nil {
			fmt.Println("Exec: couldn't write response:", err)
		}
	case http.StatusLocked:
		writeError(w, http.StatusLocked, ErrorResponse{Critical: false, Message: "container locked"})
	default:
		writeError(w, http.StatusInternalServerError, ErrorResponse{Critical: true, Message: "container error", Error: string(body)})
	}
}
