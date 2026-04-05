package utils

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net"
	"net/http"
	"os"
	"path"
	"regexp"
	"strconv"
)

var (
	DockerRegistry string
	WorkingDir     string
	Token          string
)

// ValidContainerName ensures a container name is safe for use with Docker.
var ValidContainerName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,127}$`)

// Score parsing regexes (shared by check and submission poll handlers)
var ScoreRegex = regexp.MustCompile(`Score:\s*(\d+)/(\d+)\s*\((\d+)%\)`)
var PassRegex = regexp.MustCompile(`\bPASS\b`)
var FailRegex = regexp.MustCompile(`\bFAIL\b`)
var AnsiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func StripAnsi(s string) string {
	return AnsiRegex.ReplaceAllString(s, "")
}

// ScoreResult holds parsed check.sh output.
type ScoreResult struct {
	Score      int    `json:"score"`
	Total      int    `json:"total"`
	Percentage int    `json:"percentage"`
	Passed     bool   `json:"passed"`
	RawOutput  string `json:"raw_output"`
}

// ParseScore extracts a score from check.sh output.
// It first tries "Score: X/Y (Z%)" format, then falls back to counting PASS/FAIL lines.
func ParseScore(rawOutput string) ScoreResult {
	cleanOutput := StripAnsi(rawOutput)
	matches := ScoreRegex.FindStringSubmatch(cleanOutput)

	var result ScoreResult
	result.RawOutput = cleanOutput

	if len(matches) == 4 {
		result.Score, _ = strconv.Atoi(matches[1])
		result.Total, _ = strconv.Atoi(matches[2])
		result.Percentage, _ = strconv.Atoi(matches[3])
		result.Passed = result.Score == result.Total && result.Total > 0
	} else {
		passCount := len(PassRegex.FindAllString(cleanOutput, -1))
		failCount := len(FailRegex.FindAllString(cleanOutput, -1))
		result.Score = passCount
		result.Total = passCount + failCount
		if result.Total > 0 {
			result.Percentage = (result.Score * 100) / result.Total
		}
		result.Passed = failCount == 0 && passCount > 0
	}

	return result
}

// GenerateContainerName creates a unique container name: easyshell-<12 hex chars>.
func GenerateContainerName() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate random bytes: " + err.Error())
	}
	return "easyshell-" + hex.EncodeToString(b)
}

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

	Token = os.Getenv("MUSTANG_TOKEN")
	if len(Token) == 0 {
		Token = os.Getenv("TOKEN")
	}
	if len(Token) == 0 {
		panic("MUSTANG_TOKEN must be set")
	}
}

func init() {
	Init()
}

// Mkdirp creates a directory (and parents) or panics.
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
