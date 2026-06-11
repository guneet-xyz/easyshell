// TODO: Manage logs

package exec

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"session-manager/utils"
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
	//TODO: input validation

	fmt.Println("Container: ", reqBody.ContainerName)
	fmt.Println("Command: ", string(reqBody.Command))

	// This doesn't matter, we are using a socket
	// but an endpoint still needs to be passed for whatever reason
	endpoint := "http://localhost/whatever"

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(reqBody.Command))
	if err != nil {
		http.Error(w, "Failed (couldn't construct request) : "+err.Error(), http.StatusInternalServerError)
		return
	}

	socketPath := path.Join(utils.WorkingDir, "sessions", reqBody.ContainerName, "main.sock")
	client := utils.SocketClient(socketPath)

	resp, err := client.Do(req)
	if err != nil {
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
			if json.NewEncoder(w).Encode(ErrorResponse{
				Critical: true,
				Message:  "container error",
				Error:    "couldn't read response body",
			}) != nil {
				panic("couldn't write error response")
			}
			return
		}

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

	w.WriteHeader(http.StatusOK)
	_, err = w.Write(resp_body)
	if err != nil {
		panic("couldn't write error response")
	}
}
