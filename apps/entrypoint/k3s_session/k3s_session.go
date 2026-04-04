package k3s_session

import (
	"fmt"
	"os"
	"os/exec"
	"time"

	"entrypoint/session"
)

const (
	readyFilePath     = "/tmp/easyshell/ready"
	setupScriptPath   = "/setup.sh"
	maxK3sWaitSeconds = 120
)

// Main starts k3s, waits for it to be ready, runs setup.sh, then starts
// the interactive shell session (delegating to the standard session.Main).
func Main() {
	fmt.Println("[k3s-session] Starting k3s server...")

	// Start k3s server in the background with resource-saving flags.
	// Redirect k3s output to a log file to avoid interfering with the
	// delimiter-based stdout/stderr capture in the session shell.
	logFile, err := os.OpenFile("/var/log/k3s.log", os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		panic("[k3s-session] Failed to open k3s log file: " + err.Error())
	}
	defer logFile.Close()

	k3sCmd := exec.Command("k3s", "server",
		"--disable=traefik",
		"--disable=servicelb",
		"--disable=metrics-server",
		"--disable-helm-controller",
		"--write-kubeconfig-mode=644",
	)
	k3sCmd.Stdout = logFile
	k3sCmd.Stderr = logFile

	if err := k3sCmd.Start(); err != nil {
		panic("[k3s-session] Failed to start k3s: " + err.Error())
	}

	// Monitor k3s process in background -- if it exits, we should know
	go func() {
		err := k3sCmd.Wait()
		fmt.Printf("[k3s-session] k3s process exited: %v\n", err)
		// Don't panic here -- the session may still be useful for debugging
	}()

	// Wait for k3s API server to become ready
	fmt.Println("[k3s-session] Waiting for k3s API server...")
	if !waitForK3s(maxK3sWaitSeconds) {
		// Write error status and exit
		os.WriteFile(readyFilePath+".error", []byte("k3s failed to start within timeout"), 0644)
		panic("[k3s-session] k3s failed to become ready within timeout")
	}
	fmt.Println("[k3s-session] k3s API server is ready")

	// Run setup.sh if it exists
	if _, err := os.Stat(setupScriptPath); err == nil {
		fmt.Println("[k3s-session] Running setup.sh...")
		setupCmd := exec.Command("bash", setupScriptPath)
		setupCmd.Stdout = os.Stdout
		setupCmd.Stderr = os.Stderr
		setupCmd.Env = append(os.Environ(), "KUBECONFIG=/etc/rancher/k3s/k3s.yaml")

		if err := setupCmd.Run(); err != nil {
			os.WriteFile(readyFilePath+".error", []byte("setup.sh failed: "+err.Error()), 0644)
			panic("[k3s-session] setup.sh failed: " + err.Error())
		}
		fmt.Println("[k3s-session] setup.sh completed successfully")
	} else {
		fmt.Println("[k3s-session] No setup.sh found, skipping")
	}

	// Signal readiness
	if err := os.WriteFile(readyFilePath, []byte("ready"), 0644); err != nil {
		fmt.Printf("[k3s-session] Warning: could not write ready file: %v\n", err)
	}

	// Now start the interactive shell session.
	// The session.Main() function starts `sh` and listens on the Unix socket.
	// We set KUBECONFIG so kubectl works in the user's shell.
	os.Setenv("KUBECONFIG", "/etc/rancher/k3s/k3s.yaml")
	session.Main()
}

// waitForK3s polls `kubectl cluster-info` until it succeeds or times out.
func waitForK3s(timeoutSeconds int) bool {
	deadline := time.Now().Add(time.Duration(timeoutSeconds) * time.Second)

	for time.Now().Before(deadline) {
		cmd := exec.Command("kubectl", "cluster-info")
		cmd.Env = append(os.Environ(), "KUBECONFIG=/etc/rancher/k3s/k3s.yaml")
		if err := cmd.Run(); err == nil {
			return true
		}
		time.Sleep(2 * time.Second)
	}
	return false
}

// IsReady checks if the readiness file exists (used by session-manager polling)
func IsReady() bool {
	socketPath := "/tmp/easyshell/ready"
	_, err := os.Stat(socketPath)
	return err == nil
}
