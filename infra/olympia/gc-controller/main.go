// Package main implements the easyshell GC controller.
//
// It periodically lists all namespaces labeled `easyshell.sh/session=true`
// and deletes those whose `easyshell.sh/last-activity-at` annotation is
// missing, unparseable as RFC 3339, or older than 300 seconds.
//
// The session label check is the safety latch: namespaces without the
// label are NEVER touched. There is no leader election; the Deployment
// is hard-pinned to one replica.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	sessionLabel      = "easyshell.sh/session=true"
	activityAnnotation = "easyshell.sh/last-activity-at"
	idleThreshold      = 300 * time.Second
	tickInterval       = 30 * time.Second
	healthStaleAfter   = 90 * time.Second
	healthAddr         = ":8080"
)

// lastTickAt holds the unix-nano timestamp of the most recent successful tick.
var lastTickAt int64

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	log.Printf("gc-controller starting: label=%q annotation=%q threshold=%s interval=%s",
		sessionLabel, activityAnnotation, idleThreshold, tickInterval)

	cfg, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("InClusterConfig failed: %v", err)
	}

	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		log.Fatalf("NewForConfig failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		s := <-sigCh
		log.Printf("received signal %s; shutting down", s)
		cancel()
	}()

	atomic.StoreInt64(&lastTickAt, time.Now().UnixNano())
	go startHealthServer(ctx)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Run once immediately so the controller works without waiting a full interval.
	runTick(ctx, client)

	for {
		select {
		case <-ctx.Done():
			log.Printf("context cancelled; exiting")
			os.Exit(0)
		case <-ticker.C:
			runTick(ctx, client)
			log.Printf("sleeping %s until next tick", tickInterval)
		}
	}
}

// runTick performs one reconcile pass: list session namespaces and delete
// those that are expired or have missing/unparseable activity annotations.
func runTick(ctx context.Context, client kubernetes.Interface) {
	log.Printf("tick start: listing namespaces with selector %q", sessionLabel)

	nsList, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		LabelSelector: sessionLabel,
	})
	if err != nil {
		log.Printf("list namespaces failed: %v", err)
		return
	}

	log.Printf("tick: found %d session namespaces", len(nsList.Items))

	now := time.Now()
	for _, ns := range nsList.Items {
		decideAndAct(ctx, client, ns.Name, ns.Annotations, now)
	}

	atomic.StoreInt64(&lastTickAt, time.Now().UnixNano())
	log.Printf("tick complete")
}

// decideAndAct evaluates whether the given namespace should be deleted and
// performs the deletion if so. Decisions are logged per namespace.
func decideAndAct(ctx context.Context, client kubernetes.Interface, name string, annotations map[string]string, now time.Time) {
	val, ok := annotations[activityAnnotation]
	if !ok {
		log.Printf("ns=%s decision=DELETE reason=missing-annotation", name)
		deleteNamespace(ctx, client, name)
		return
	}

	parsed, err := time.Parse(time.RFC3339, val)
	if err != nil {
		log.Printf("ns=%s decision=DELETE reason=unparseable-annotation value=%q err=%v", name, val, err)
		deleteNamespace(ctx, client, name)
		return
	}

	age := now.Sub(parsed)
	if age > idleThreshold {
		log.Printf("ns=%s decision=DELETE reason=expired age=%s threshold=%s", name, age, idleThreshold)
		deleteNamespace(ctx, client, name)
		return
	}

	log.Printf("ns=%s decision=KEEP age=%s threshold=%s", name, age, idleThreshold)
}

// deleteNamespace calls the API to delete the namespace. Errors are logged
// but do not abort the tick.
func deleteNamespace(ctx context.Context, client kubernetes.Interface, name string) {
	if err := client.CoreV1().Namespaces().Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
		log.Printf("ns=%s delete failed: %v", name, err)
		return
	}
	log.Printf("ns=%s deleted", name)
}

// startHealthServer serves /healthz on :8080. Returns 500 if the last
// successful tick was more than healthStaleAfter ago.
func startHealthServer(ctx context.Context) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		last := atomic.LoadInt64(&lastTickAt)
		age := time.Since(time.Unix(0, last))
		if age > healthStaleAfter {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, "stale: last tick %s ago\n", age)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "ok: last tick %s ago\n", age)
	})

	srv := &http.Server{
		Addr:              healthAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Printf("health server listening on %s/healthz", healthAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("health server error: %v", err)
	}
}
