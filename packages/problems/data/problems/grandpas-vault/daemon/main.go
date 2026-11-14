package main

import (
	_ "embed"
	"encoding/json"
	"net/http"
)

//go:embed data.json
var dataJSON []byte

type Data struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Treasure string `json:"treasure"`
}

type VaultResponse struct {
	Treasure *string `json:"treasure"`
	Message  string  `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, object interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(object); err != nil {
		panic("Error while encoding response: " + err.Error())
	}
}

func main() {
	var data Data
	if err := json.Unmarshal(dataJSON, &data); err != nil {
		panic("Error while decoding data.json: " + err.Error())
	}

	http.HandleFunc("/vault", func(w http.ResponseWriter, req *http.Request) {
		// BasicAuth splits the credentials at the first colon.
		username, password, ok := req.BasicAuth()
		if !ok {
			w.Header().Set("WWW-Authenticate", `Basic realm="Grandpa's Vault"`)
			writeJSON(w, http.StatusUnauthorized, VaultResponse{
				Treasure: nil,
				Message:  "Halt! Who goes there? Grandpa wants a username and a password.",
			})
			return
		}
		if username != data.Username || password != data.Password {
			w.Header().Set("WWW-Authenticate", `Basic realm="Grandpa's Vault"`)
			writeJSON(w, http.StatusUnauthorized, VaultResponse{
				Treasure: nil,
				Message:  "Wrong username or password, whippersnapper.",
			})
			return
		}

		writeJSON(w, http.StatusOK, VaultResponse{
			Treasure: &data.Treasure,
			Message:  "Welcome, family member. Don't tell your cousins.",
		})
	})

	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Error while starting server: " + err.Error())
	}
}
