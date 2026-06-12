package utils

import (
	"context"
	"net"
	"net/http"
	"os"
	"path"
	"strconv"
)

var (
	DockerRegistry           string
	WorkingDir               string
	Token                    string
	SubmissionMaxConcurrency int
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

	submissionMaxConcurrencyStr := os.Getenv("SUBMISSION_MAX_CONCURRENCY")
	if submissionMaxConcurrencyStr == "" {
		SubmissionMaxConcurrency = 4
	} else {
		val, err := strconv.Atoi(submissionMaxConcurrencyStr)
		if err != nil || val <= 0 {
			panic("SUBMISSION_MAX_CONCURRENCY must be a positive integer, got: " + submissionMaxConcurrencyStr)
		}
		SubmissionMaxConcurrency = val
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
