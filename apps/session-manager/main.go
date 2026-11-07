package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path"
	"session-manager/handlers/create"
	exec_handler "session-manager/handlers/exec"
	is_running "session-manager/handlers/is-running"
	"session-manager/handlers/kill"
	"session-manager/utils"
	"strconv"
	"strings"
	"time"
)

// reapExpiredSessions kills session containers past their expiry label, so
// abandoned sessions do not accumulate.
func reapExpiredSessions() {
	for {
		output, err := exec.Command("docker", "ps", "--filter", "label=easyshell.session=1",
			"--format", `{{.Names}} {{.Label "easyshell.expires"}}`).Output()
		if err != nil {
			fmt.Println("Session reaper: listing containers failed:", err)
		}
		now := time.Now().Unix()
		for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
			fields := strings.Fields(line)
			if len(fields) != 2 {
				continue
			}
			expires, err := strconv.ParseInt(fields[1], 10, 64)
			if err != nil || expires > now {
				continue
			}
			fmt.Println("Session reaper: killing expired", fields[0])
			_ = exec.Command("docker", "container", "kill", fields[0]).Run()
			_ = os.RemoveAll(path.Join(utils.WorkingDir, "sessions", fields[0]))
		}
		time.Sleep(time.Minute)
	}
}

func main() {
	utils.Init()
	go reapExpiredSessions()

	http.HandleFunc("/exec", exec_handler.Handler)
	http.HandleFunc("/create", create.Handler)
	http.HandleFunc("/is-running", is_running.Handler)
	http.HandleFunc("/kill", kill.Handler)

	fmt.Println("Listening on port 4000")
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Failed to start server")
	}
}
