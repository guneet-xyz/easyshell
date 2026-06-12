package run_submission

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path"
	"strings"
	"sync"
	"time"

	"session-manager/utils"
)

type Metadata struct {
	SubmissionID int    `json:"submission_id"`
	TestcaseID   int    `json:"testcase_id"`
	ProblemSlug  string `json:"problem_slug"`
}

type postRequest struct {
	Image    string   `json:"image"`
	Input    string   `json:"input"`
	Metadata Metadata `json:"metadata"`
}

type postResponse struct {
	JobID         string `json:"job_id"`
	ContainerName string `json:"container_name"`
}

type JobStatus string

const (
	StatusRunning JobStatus = "running"
	StatusDone    JobStatus = "done"
	StatusError   JobStatus = "error"
)

type jobResult struct {
	Stdout     string            `json:"stdout"`
	Stderr     string            `json:"stderr"`
	ExitCode   int               `json:"exit_code"`
	Fs         map[string]string `json:"fs"`
	StartedAt  time.Time         `json:"started_at"`
	FinishedAt time.Time         `json:"finished_at"`
}

type Job struct {
	mu          sync.Mutex
	Status      JobStatus
	Result      *jobResult
	ErrorMsg    string
	CompletedAt time.Time
}

type entrypointOutput struct {
	Stdout   string            `json:"stdout"`
	Stderr   string            `json:"stderr"`
	ExitCode int               `json:"exit_code"`
	Fs       map[string]string `json:"fs"`
}

var (
	jobs   = make(map[string]*Job)
	jobsMu sync.RWMutex

	sem     chan struct{}
	semOnce sync.Once
)

func init() {
	go ttlSweepLoop()
}

func ttlSweepLoop() {
	for {
		time.Sleep(60 * time.Second)
		now := time.Now()
		jobsMu.Lock()
		for id, job := range jobs {
			job.mu.Lock()
			if job.Status != StatusRunning && !job.CompletedAt.IsZero() && now.Sub(job.CompletedAt) > 5*time.Minute {
				delete(jobs, id)
			}
			job.mu.Unlock()
		}
		jobsMu.Unlock()
	}
}

func ensureSemInit() {
	semOnce.Do(func() {
		sem = make(chan struct{}, utils.SubmissionMaxConcurrency)
	})
}

func generateShortUUID() string {
	b := make([]byte, 4)
	_, err := rand.Read(b)
	if err != nil {
		panic("failed to generate uuid: " + err.Error())
	}
	return fmt.Sprintf("%08x", b)
}

func setJobError(job *Job, msg string) {
	job.mu.Lock()
	job.Status = StatusError
	job.ErrorMsg = msg
	job.CompletedAt = time.Now()
	job.mu.Unlock()
}

func PostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+utils.Token {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req postRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	if req.Image == "" || req.Metadata.SubmissionID <= 0 || req.Metadata.TestcaseID <= 0 || req.Metadata.ProblemSlug == "" {
		http.Error(w, "Bad Request: missing required fields", http.StatusBadRequest)
		return
	}

	ensureSemInit()
	select {
	case sem <- struct{}{}:
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "server at capacity"})
		return
	}

	shortUUID := generateShortUUID()
	jobID := fmt.Sprintf("%s-%s", shortUUID, generateShortUUID())
	containerName := fmt.Sprintf("easyshell-%s-%d-submission-%d-%s",
		req.Metadata.ProblemSlug, req.Metadata.TestcaseID, req.Metadata.SubmissionID, shortUUID)

	job := &Job{Status: StatusRunning}
	jobsMu.Lock()
	jobs[jobID] = job
	jobsMu.Unlock()

	go runJob(jobID, containerName, req, job)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(postResponse{JobID: jobID, ContainerName: containerName})
}

func runJob(jobID, containerName string, req postRequest, job *Job) {
	defer func() {
		<-sem
		if r := recover(); r != nil {
			job.mu.Lock()
			job.Status = StatusError
			job.ErrorMsg = fmt.Sprintf("panic: %v", r)
			job.CompletedAt = time.Now()
			job.mu.Unlock()
		}
	}()

	startedAt := time.Now()

	containerDir := path.Join(utils.WorkingDir, "submissions", containerName)
	utils.Mkdirp(containerDir)
	defer os.RemoveAll(containerDir)

	inputPath := path.Join(containerDir, "input.sh")
	outputPath := path.Join(containerDir, "output.json")

	if err := os.WriteFile(inputPath, []byte(req.Input), 0600); err != nil {
		setJobError(job, "failed to write input: "+err.Error())
		return
	}
	if err := os.WriteFile(outputPath, []byte("{}"), 0600); err != nil {
		setJobError(job, "failed to write output placeholder: "+err.Error())
		return
	}

	pullPolicy := ""
	if utils.DockerRegistry != "" {
		pullPolicy = "--pull=always"
	}
	var imageTag string
	if utils.DockerRegistry != "" {
		imageTag = utils.DockerRegistry + "/easyshell/" + req.Image
	} else {
		imageTag = req.Image
	}

	dockerCmd := fmt.Sprintf(
		"docker run -q --rm --name %s -v %s:/input.sh -v %s:/output.json -m 10m --cpus 0.1 %s %s -mode submission",
		containerName, inputPath, outputPath, pullPolicy, imageTag,
	)

	cmd := exec.Command("sh", "-c", dockerCmd)
	combinedOutput, err := cmd.CombinedOutput()
	finishedAt := time.Now()

	if err != nil {
		errMsg := "docker run failed: " + err.Error()
		if len(combinedOutput) > 0 {
			truncated := string(combinedOutput)
			if len(truncated) > 500 {
				truncated = truncated[:500]
			}
			errMsg += " | output: " + truncated
		}
		setJobError(job, errMsg)
		return
	}

	outputBytes, err := os.ReadFile(outputPath)
	if err != nil {
		setJobError(job, "failed to read output: "+err.Error())
		return
	}
	var out entrypointOutput
	if err := json.Unmarshal(outputBytes, &out); err != nil {
		setJobError(job, "failed to parse output json: "+err.Error())
		return
	}

	job.mu.Lock()
	job.Status = StatusDone
	job.Result = &jobResult{
		Stdout:     out.Stdout,
		Stderr:     out.Stderr,
		ExitCode:   out.ExitCode,
		Fs:         out.Fs,
		StartedAt:  startedAt,
		FinishedAt: finishedAt,
	}
	job.CompletedAt = finishedAt
	job.mu.Unlock()
}

func GetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer "+utils.Token {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	jobID := strings.TrimPrefix(r.URL.Path, "/run-submission/")
	if jobID == "" || jobID == r.URL.Path {
		http.Error(w, "Bad Request: missing job_id", http.StatusBadRequest)
		return
	}

	jobsMu.RLock()
	job, ok := jobs[jobID]
	jobsMu.RUnlock()
	if !ok {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}

	job.mu.Lock()
	status := job.Status
	result := job.Result
	errMsg := job.ErrorMsg
	job.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	switch status {
	case StatusRunning:
		json.NewEncoder(w).Encode(map[string]string{"status": "running"})
	case StatusDone:
		type doneResponse struct {
			Status     string            `json:"status"`
			Stdout     string            `json:"stdout"`
			Stderr     string            `json:"stderr"`
			ExitCode   int               `json:"exit_code"`
			Fs         map[string]string `json:"fs"`
			StartedAt  time.Time         `json:"started_at"`
			FinishedAt time.Time         `json:"finished_at"`
		}
		json.NewEncoder(w).Encode(doneResponse{
			Status:     "done",
			Stdout:     result.Stdout,
			Stderr:     result.Stderr,
			ExitCode:   result.ExitCode,
			Fs:         result.Fs,
			StartedAt:  result.StartedAt,
			FinishedAt: result.FinishedAt,
		})
	case StatusError:
		json.NewEncoder(w).Encode(map[string]string{"status": "error", "error": errMsg})
	}
}
