# Olympia Runbook

Operator-facing guide for provisioning and maintaining the **olympia** VPS, the single-node k3s host that backs Phase 1 of easyshell. Read this top to bottom before your first provision. For the formal contract surface (namespaces, labels, annotations, RBAC) consumed by Phase 2 (mustang), see [CONTRACT.md](./CONTRACT.md).

## Prerequisites

Before you run anything on the target machine:

- A clean Ubuntu/Debian VPS (Ubuntu 22.04 or 24.04 recommended); root via sudo.
- Tailscale admin console access (to approve the device after first connect).
- `REGISTRY_PASSWORD`: generate a strong password and store it securely. A reasonable default:
  ```bash
  openssl rand -base64 32
  ```
- `GITHUB_OWNER`, `GHCR_USERNAME`, `GHCR_TOKEN`: a GitHub PAT with `read:packages` scope, used by k3s to pull the GC controller image from GHCR.
- The GC controller image must be **pre-published** to `ghcr.io/${GITHUB_OWNER}/easyshell-gc-controller:v1` before provisioning. The CI workflow at `.github/workflows/gc-controller-image.yml` builds and pushes it on every push to `main`. If the image isn't there, `setup.sh` will succeed but the GC pod stays in `ImagePullBackOff`.

## First Provision (Real VPS)

Step by step on a fresh VPS:

1. SSH into the VPS as root (or a sudo user).
2. Clone the repo:
   ```bash
   git clone https://github.com/<owner>/easyshell.git && cd easyshell
   ```
3. Export the required env vars:
   ```bash
   export REGISTRY_PASSWORD="<your-password>"
   export GITHUB_OWNER="<github-owner>"
   export GHCR_USERNAME="<github-username>"
   export GHCR_TOKEN="<pat-with-read:packages>"
   ```
4. Run the provisioner:
   ```bash
   sudo -E bash infra/olympia/setup.sh
   ```
5. When prompted, click the Tailscale auth URL in your browser and approve the device in the Tailscale admin console.
6. Verify the cluster is healthy:
   ```bash
   sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get pods -A
   ```
   Expect:
   - `registry` pod `Running` in the `registry` namespace.
   - `gc-controller` pod `Running` in the `gc-system` namespace.
7. Note the SSH router pubkey fingerprint printed at the end. Transfer `/root/easyshell-router-key` (the **private** key) to the prod session-manager out-of-band; this is the credential Phase 3 will use to exec into session pods.

## First Provision (Local Multipass Smoke)

For a dry run on your laptop, the Multipass harness mirrors a real VPS closely enough to catch most regressions:

```bash
export REGISTRY_PASSWORD="smoke-test-pw"
export GITHUB_OWNER="<owner>"
export GHCR_USERNAME="<user>"
export GHCR_TOKEN="<pat>"
make -C infra/olympia/multipass up
make -C infra/olympia/multipass provision
make -C infra/olympia/multipass smoke
```

See [`multipass/Makefile`](./multipass/Makefile) for all available targets (`up`, `provision`, `smoke`, `down`, `reset`, `shell`).

Note: The GC image must already be published to GHCR before `provision` runs (see Prerequisites). The smoke does not build the image locally.

## Restart Procedure

- k3s restart:
  ```bash
  sudo systemctl restart k3s
  ```
- After restart, pods recover automatically (k3s manages pod lifecycle).
- Registry data persists in the PVC (`registry-data` in the `registry` namespace).
- GC controller resumes on the next tick (30s interval).
- Tailscale reconnects automatically if `tailscaled` is running.

If a pod looks wedged after restart, `kubectl delete pod` it; the Deployment/StatefulSet will replace it.

## SSH Router Key Management

The router key is the bridge between the prod session-manager (Phase 3) and per-session pods on olympia. Treat it like a production secret.

- `setup.sh` auto-generates an Ed25519 keypair at `/root/easyshell-router-key` (private) and `/root/easyshell-router-key.pub` (public).
- The pubkey is installed into `/home/router/.ssh/authorized_keys` with a `command=` restriction, so the key only ever runs the router script (see [`ssh-router.sh`](./ssh-router.sh)).
- The privkey **must** be transferred out-of-band to the prod session-manager. It will not be regenerated on re-provision (setup.sh is idempotent and preserves the existing key).
- View the fingerprint:
  ```bash
  ssh-keygen -lf /root/easyshell-router-key.pub
  ```
- Rotate by deleting both key files and re-running setup.sh, then update the session-manager with the new privkey:
  ```bash
  sudo rm /root/easyshell-router-key /root/easyshell-router-key.pub
  sudo -E bash infra/olympia/setup.sh
  ```

## Re-Provisioning

- `setup.sh` is idempotent. Re-run it safely at any time:
  ```bash
  sudo -E bash infra/olympia/setup.sh
  ```
- Each step checks its post-condition and skips if already satisfied (k3s installed, namespaces present, manifests applied, etc).
- Registry data persists in the PVC across re-provisions.
- If you're rebuilding the VPS from scratch (re-imaging the host), re-image, re-clone, re-export env vars, and re-run setup.sh. The PVC is lost in that case, which is acceptable: per design there is no DR for olympia and pushed images can be rebuilt by CI.

## Tear Down and Rebuild

- Local Multipass, quick cycle:
  ```bash
  make -C infra/olympia/multipass down
  make -C infra/olympia/multipass up provision
  ```
- Local Multipass, full reset (down + up + provision in one command):
  ```bash
  make -C infra/olympia/multipass reset
  ```
- Prod VPS: re-image the host via your provider's console, then follow [First Provision (Real VPS)](#first-provision-real-vps) from step 1.

## Troubleshooting

Common issues and the one-liner that usually surfaces the cause:

- **k3s not starting**:
  ```bash
  journalctl -u k3s -n 50
  ```
  Look for swap or kernel module errors. `setup.sh` passes `--kubelet-arg=fail-swap-on=false` but the unit still needs the systemd service healthy.
- **Registry pod not pulling or auth failing**:
  ```bash
  kubectl describe pod -n registry
  kubectl get secret registry-htpasswd -n registry
  ```
  The htpasswd Secret must exist and match `REGISTRY_PASSWORD`.
- **GC controller not deleting expired namespaces**:
  ```bash
  kubectl logs -n gc-system -l app=gc-controller
  ```
  Verify the namespace carries `easyshell.sh/session=true` and the annotation `easyshell.sh/last-activity-at` is RFC 3339. Without the label, GC skips the namespace by design.
- **Tailscale not connecting**:
  ```bash
  tailscale status
  ```
  Re-run `tailscale up --hostname=olympia --accept-routes` and re-approve in the admin console.
- **SSH router rejecting valid input**:
  Check that `/home/router/.ssh/authorized_keys` starts with `command=` and that `/home/router/.kube/config` exists and is readable by the `router` user.

## Phase 2 Hand-off

The full contract surface is in [CONTRACT.md](./CONTRACT.md). At a glance, the Phase 2 component (`mustang`) must:

- Create session namespaces matching `^session-[a-z0-9]{8}$`.
- Label them `easyshell.sh/session=true` (without this label GC will never reap them).
- Set the annotation `easyshell.sh/last-activity-at` (RFC 3339) on every inbound request to refresh the TTL.
- Copy `kube-system/registry-creds` into each session namespace so workloads can pull from the in-cluster registry.
- Bind its HTTP server only to the `tailscale0` interface; the k3s API and registry are not reachable from the public internet by design.

Anything outside that contract is internal to olympia and may change without notice. If you need a new capability from olympia, extend CONTRACT.md first, then implement.
