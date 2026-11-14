package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
)

//go:embed data.json
var dataJSON []byte

type Data struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Welcome  string `json:"welcome"`
}

type LoginResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type DashboardResponse struct {
	Welcome *string `json:"welcome"`
	Message string  `json:"message"`
}

var (
	sessions   = map[string]bool{}
	sessionsMu sync.Mutex
)

func writeJSON(w http.ResponseWriter, status int, object interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(object); err != nil {
		panic("Error while encoding response: " + err.Error())
	}
}

func newSessionId() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		panic("Error while generating a session id: " + err.Error())
	}
	return hex.EncodeToString(bytes)
}

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/login", func(w http.ResponseWriter, req *http.Request) {
		if req.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, LoginResponse{
				Status:  "error",
				Message: "Method not allowed. Log in with a POST request.",
			})
			return
		}

		// Accepts both urlencoded and multipart forms.
		username := req.PostFormValue("username")
		password := req.PostFormValue("password")
		if username != data.Username || password != data.Password {
			writeJSON(w, http.StatusUnauthorized, LoginResponse{
				Status:  "error",
				Message: "Wrong username or password. No cookie for you.",
			})
			return
		}

		sessionId := newSessionId()
		sessionsMu.Lock()
		sessions[sessionId] = true
		sessionsMu.Unlock()

		http.SetCookie(w, &http.Cookie{
			Name:     "session",
			Value:    sessionId,
			Path:     "/",
			HttpOnly: true,
		})
		writeJSON(w, http.StatusOK, LoginResponse{
			Status:  "success",
			Message: "Logged in. Here's a cookie. Don't eat it.",
		})
	})

	http.HandleFunc("/dashboard", func(w http.ResponseWriter, req *http.Request) {
		cookie, err := req.Cookie("session")
		valid := false
		if err == nil {
			sessionsMu.Lock()
			valid = sessions[cookie.Value]
			sessionsMu.Unlock()
		}
		if !valid {
			writeJSON(w, http.StatusUnauthorized, DashboardResponse{
				Welcome: nil,
				Message: "Me no see valid cookie. Me no let you in. Log in first.",
			})
			return
		}

		writeJSON(w, http.StatusOK, DashboardResponse{
			Welcome: &data.Welcome,
			Message: "Om nom nom. Cookie accepted.",
		})
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
