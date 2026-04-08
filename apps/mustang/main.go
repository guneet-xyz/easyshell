package main

import (
	"bytes"
	"fmt"
	"io"
	"mustang/handlers/check"
	"mustang/handlers/create"
	"mustang/handlers/exec"
	"mustang/handlers/kill"
	"mustang/handlers/ready"
	exec_stream "mustang/handlers/session/exec_stream"
	submission_create "mustang/handlers/submission/create"
	submission_poll "mustang/handlers/submission/poll"
	"mustang/utils"
	"net/http"
	"strings"
	"time"
)

// responseRecorder wraps http.ResponseWriter to capture the status code.
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

// logMiddleware wraps an http.HandlerFunc with request/response logging.
// Logs: timestamp, method, path, request body (for POST), status code, and duration.
func logMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Read and log the request body for POST/PUT/PATCH, then restore it
		// so the downstream handler can still read it.
		var bodySnippet string
		if r.Body != nil && r.Method != "GET" {
			bodyBytes, err := io.ReadAll(r.Body)
			r.Body.Close()
			if err == nil {
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				bodySnippet = strings.TrimSpace(string(bodyBytes))
				// Collapse to single line for log readability
				bodySnippet = strings.Join(strings.Fields(bodySnippet), " ")
				if len(bodySnippet) > 512 {
					bodySnippet = bodySnippet[:512] + "..."
				}
			}
		}

		rr := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}

		next(rr, r)

		duration := time.Since(start)
		if bodySnippet != "" {
			fmt.Printf("[%s] %s %s%s %s -> %d (%s)\n",
				start.Format("15:04:05.000"),
				r.Method,
				r.URL.Path,
				formatQuery(r),
				bodySnippet,
				rr.statusCode,
				formatDuration(duration),
			)
		} else {
			fmt.Printf("[%s] %s %s%s -> %d (%s)\n",
				start.Format("15:04:05.000"),
				r.Method,
				r.URL.Path,
				formatQuery(r),
				rr.statusCode,
				formatDuration(duration),
			)
		}
	}
}

func formatQuery(r *http.Request) string {
	q := r.URL.RawQuery
	if q == "" {
		return ""
	}
	return "?" + q
}

func formatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%dµs", d.Microseconds())
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%.1fs", d.Seconds())
}

func main() {
	utils.Init()

	// Session endpoints
	http.HandleFunc("/session/create", logMiddleware(create.Handler))
	http.HandleFunc("/session/ready", logMiddleware(ready.Handler))
	http.HandleFunc("/session/exec", logMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// Route GET to SSE stream, POST to regular exec
		if r.Method == "GET" {
			exec_stream.Handler(w, r)
		} else {
			exec.Handler(w, r)
		}
	}))
	http.HandleFunc("/session/kill", logMiddleware(kill.Handler))
	http.HandleFunc("/session/check", logMiddleware(check.Handler))

	// Submission endpoints
	http.HandleFunc("/submission/create", logMiddleware(submission_create.Handler))
	http.HandleFunc("/submission/poll", logMiddleware(submission_poll.Handler))

	fmt.Println("Listening on port 4000")
	err := http.ListenAndServe(":4000", nil)
	if err != nil {
		panic("Failed to start server")
	}
}
