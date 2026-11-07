package utils

import (
	"context"
	"net"
	"net/http"
	"os"
	"path"
	"regexp"
	"time"
)

// SessionLifetime matches the website's terminal session expiry.
const SessionLifetime = time.Hour

// MaxSessions caps concurrent session containers across all users.
const MaxSessions = 60

var validName = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{0,127}$`)

// ValidName reports whether s is safe to use as a container or image name and as
// a single path element. Names are passed to docker as arguments, never a shell.
func ValidName(s string) bool {
	return validName.MatchString(s)
}

var (
	DockerRegistry string
	WorkingDir     string
	Token          string
)

func Init() {
	DockerRegistry = os.Getenv("DOCKER_REGISTRY")

	WorkingDir = os.Getenv("WORKING_DIR")
	if len(WorkingDir) == 0 {
		WorkingDir = "/tmp/easyshell"
	}
	if !path.IsAbs(WorkingDir) {
		panic("WORKING_DIR must be an absolute path")
	}

	Mkdirp(WorkingDir)
	Mkdirp(path.Join(WorkingDir, "sessions"))

	Token = os.Getenv("TOKEN")
	if len(Token) == 0 {
		panic("TOKEN must be set")
	}
}

func init() {
	Init()
}

// make directory or panic
func Mkdirp(path string) {
	stat, err := os.Stat(path)
	if os.IsNotExist(err) {
		err := os.MkdirAll(path, os.ModePerm)
		if err != nil {
			panic("Failed to create directory: " + path)
		}
	} else if err != nil {
		panic("Failed to check directory: " + path)
	} else if !stat.IsDir() {
		panic("Path is not a directory: " + path)
	}
}

func SocketClient(socketPath string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return net.Dial("unix", socketPath)
			},
		},
	}
}
