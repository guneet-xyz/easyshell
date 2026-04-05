// TODO: Manage logs

package exec

import (
	"encoding/json"
	"fmt"
	"io"
	"mustang/utils"
	"net/http"
	osexec "os/exec"
	"path"
	"strings"
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

	var reqBody requestBody
	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, "Critical Failure (couldn't parse request body) : ", http.StatusBadRequest)
		// This should never happen.
		return
	}
	if !validContainerName.MatchString(reqBody.ContainerName) {
		http.Error(w, "Invalid container name", http.StatusBadRequest)
		return
	}

	fmt.Println("Container: ", reqBody.ContainerName)
	fmt.Println("Command: ", string(reqBody.Command))

	// This doesn't matter, we are using a socket
	// but an endpoint still needs to be passed for whatever reason
	endpoint := "http://localhost/whatever"

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(reqBody.Command))
	if err != nil {
		fmt.Println("Failed to construct request: ", err)
		http.Error(w, "Failed (couldn't construct request) : "+err.Error(), http.StatusInternalServerError)
		return
	}

	socketPath := path.Join(utils.WorkingDir, "sessions", reqBody.ContainerName, "main.sock")

	// Ensure the socket is accessible — the container creates it as root,
	// so chmod it from inside the container where we have root permissions.
	chmodCmd := osexec.Command("docker", "exec", reqBody.ContainerName, "chmod", "0777", "/tmp/easyshell/main.sock")
	if out, err := chmodCmd.CombinedOutput(); err != nil {
		fmt.Printf("Warning: failed to chmod socket in %s: %s (%s)\n", reqBody.ContainerName, err, string(out))
	}

	client := utils.SocketClient(socketPath)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Request failed: ", err)
		w.WriteHeader(http.StatusInternalServerError)
		if json.NewEncoder(w).Encode(ErrorResponse{
			Critical: true,
			Message:  "request failed, container might be down",
			Error:    err.Error(),
		}) != nil {
			panic("couldn't write error response")
		}
		return
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Println("Container error: ", resp.StatusCode)
		if resp.StatusCode == http.StatusLocked {
			w.WriteHeader(http.StatusLocked)
			if json.NewEncoder(w).Encode(ErrorResponse{
				Critical: false,
				Message:  "container locked",
				Error:    "",
			}) != nil {
				panic("couldn't write error response")
			}
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		containerError, err := io.ReadAll(resp.Body)
		if err != nil {
			fmt.Println("Couldn't read response body: ", err)
			if json.NewEncoder(w).Encode(ErrorResponse{
				Critical: true,
				Message:  "container error",
				Error:    "couldn't read response body",
			}) != nil {
				panic("couldn't write error response")
			}
			return
		}

		fmt.Println("Container error response: ", string(containerError))
		if json.NewEncoder(w).Encode(ErrorResponse{
			Critical: true,
			Message:  "container error",
			Error:    string(containerError),
		}) != nil {
			panic("couldn't write error response")
		}

		return
	}

	resp_body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Couldn't read response body: ", err)
		w.WriteHeader(http.StatusInternalServerError)
		if json.NewEncoder(w).Encode(ErrorResponse{
			Critical: true,
			Message:  "couldn't read response body",
			Error:    err.Error(),
		}) != nil {
			panic("couldn't write error response")
		}
		return
	}

	fmt.Println("Command output: ", string(resp_body))
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(resp_body)
	if err != nil {
		panic("couldn't write error response")
	}
}
