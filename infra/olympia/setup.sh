#!/usr/bin/env bash
#
# olympia VPS provisioning script.
#
# Idempotent, end-to-end bootstrap for a single-node k3s host that serves
# easyshell's per-tenant ephemeral compute. Re-running this script is safe:
# every step checks its post-condition and skips if already satisfied.
#
# Usage (from repo root):
#   sudo REGISTRY_PASSWORD=... GITHUB_OWNER=... GHCR_USERNAME=... GHCR_TOKEN=... \
#     bash infra/olympia/setup.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Required env vars (fail fast).
# ---------------------------------------------------------------------------
: "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD must be set}"
: "${GITHUB_OWNER:?GITHUB_OWNER must be set}"
: "${GHCR_USERNAME:?GHCR_USERNAME must be set}"
: "${GHCR_TOKEN:?GHCR_TOKEN must be set}"

REGISTRY_USERNAME="${REGISTRY_USERNAME:-admin}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-olympia}"
GC_IMAGE_TAG="${GC_IMAGE_TAG:-v1}"

export REGISTRY_USERNAME REGISTRY_PASSWORD TAILSCALE_HOSTNAME GC_IMAGE_TAG GITHUB_OWNER GHCR_USERNAME GHCR_TOKEN

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KUBECONFIG_PATH="/etc/rancher/k3s/k3s.yaml"

# Step status tracking
declare -A STEP_STATUS

step_log() {
  local num="$1" name="$2" state="$3"
  echo "[step ${num}/12] ${name}: ${state}"
  STEP_STATUS["${num}-${name}"]="${state}"
}

run_kubectl() {
  KUBECONFIG="$KUBECONFIG_PATH" kubectl "$@"
}

# ---------------------------------------------------------------------------
# Step 1 — Preflight
# ---------------------------------------------------------------------------
step1_preflight() {
  step_log 1 "preflight" "RUN"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: apt-get is required (Debian/Ubuntu only)" >&2
    exit 1
  fi
  local kver kmajor kminor
  kver="$(uname -r | cut -d- -f1)"
  kmajor="$(echo "$kver" | cut -d. -f1)"
  kminor="$(echo "$kver" | cut -d. -f2)"
  if (( kmajor < 5 )) || (( kmajor == 5 && kminor < 3 )); then
    echo "ERROR: kernel >= 5.3 required (have ${kver})" >&2
    exit 1
  fi
  step_log 1 "preflight" "DONE"
}

# ---------------------------------------------------------------------------
# Step 2 — Kernel modules + sysctls
# ---------------------------------------------------------------------------
step2_kernel() {
  local modules_file="/etc/modules-load.d/k3s.conf"
  local sysctl_file="/etc/sysctl.d/99-k3s.conf"
  local want_modules=$'br_netfilter\noverlay'
  local want_sysctl=$'net.bridge.bridge-nf-call-iptables=1\nnet.ipv4.ip_forward=1'

  if [[ -f "$modules_file" ]] && diff -q <(printf '%s\n' "$want_modules") "$modules_file" >/dev/null 2>&1 \
     && [[ -f "$sysctl_file" ]] && diff -q <(printf '%s\n' "$want_sysctl") "$sysctl_file" >/dev/null 2>&1; then
    step_log 2 "kernel" "SKIP"
    return
  fi
  step_log 2 "kernel" "RUN"
  modprobe br_netfilter
  modprobe overlay
  printf '%s\n' "$want_modules" > "$modules_file"
  printf '%s\n' "$want_sysctl" > "$sysctl_file"
  sysctl --system >/dev/null
  step_log 2 "kernel" "DONE"
}

# ---------------------------------------------------------------------------
# Step 3 — Swap off
# ---------------------------------------------------------------------------
step3_swap() {
  if [[ -z "$(swapon --show 2>/dev/null)" ]] && ! grep -E '^[^#].*\sswap\s' /etc/fstab 2>/dev/null | grep -q .; then
    step_log 3 "swap" "SKIP"
    return
  fi
  step_log 3 "swap" "RUN"
  swapoff -a || true
  systemctl mask swap.target 2>/dev/null || true
  if [[ -f /etc/fstab ]]; then
    sed -i.bak 's/^\([^#].*swap.*\)/#\1/' /etc/fstab
  fi
  step_log 3 "swap" "DONE"
}

# ---------------------------------------------------------------------------
# Step 4 — ufw
# ---------------------------------------------------------------------------
step4_ufw() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    step_log 4 "ufw" "RUN"
    ufw disable >/dev/null 2>&1 || true
    echo "  notice: ufw was active and has been disabled (k3s manages its own iptables rules)"
    step_log 4 "ufw" "DONE"
  else
    step_log 4 "ufw" "SKIP"
  fi
}

# ---------------------------------------------------------------------------
# Step 5 — apt prereqs
# ---------------------------------------------------------------------------
step5_apt() {
  if dpkg -l curl gnupg apt-transport-https ca-certificates jq apache2-utils openssh-client gettext-base >/dev/null 2>&1; then
    step_log 5 "apt-prereqs" "SKIP"
    return
  fi
  step_log 5 "apt-prereqs" "RUN"
  apt-get update -qq
  apt-get install -y -qq curl gnupg apt-transport-https ca-certificates jq apache2-utils openssh-client gettext-base
  step_log 5 "apt-prereqs" "DONE"
}

# ---------------------------------------------------------------------------
# Step 6 — Write registries.yaml (MUST run BEFORE k3s install)
# ---------------------------------------------------------------------------
step6_registries() {
  mkdir -p /etc/rancher/k3s
  local target="/etc/rancher/k3s/registries.yaml"
  local src="${REPO_ROOT}/infra/olympia/registries.yaml"
  if [[ ! -f "$src" ]]; then
    echo "ERROR: missing $src" >&2
    exit 1
  fi
  local rendered
  rendered="$(REGISTRY_USERNAME="$REGISTRY_USERNAME" REGISTRY_PASSWORD="$REGISTRY_PASSWORD" envsubst < "$src")"
  if [[ -f "$target" ]] && [[ "$(cat "$target")" == "$rendered" ]]; then
    step_log 6 "registries.yaml" "SKIP"
    return
  fi
  step_log 6 "registries.yaml" "RUN"
  printf '%s' "$rendered" > "$target"
  chmod 0600 "$target"
  step_log 6 "registries.yaml" "DONE"
}

# ---------------------------------------------------------------------------
# Step 7 — Install k3s
# ---------------------------------------------------------------------------
step7_k3s() {
  if [[ -x /usr/local/bin/k3s ]] && systemctl is-active --quiet k3s 2>/dev/null; then
    step_log 7 "k3s" "SKIP"
    return
  fi
  step_log 7 "k3s" "RUN"
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION=v1.30.5+k3s1 \
    sh -s - server \
      --disable traefik \
      --disable servicelb \
      --kubelet-arg=fail-swap-on=false \
      --tls-san "$(hostname)"
  echo "  waiting for node Ready..."
  local tries=0
  until KUBECONFIG="$KUBECONFIG_PATH" kubectl get nodes 2>/dev/null | grep -qE '\sReady\s'; do
    sleep 5
    tries=$((tries+1))
    if (( tries > 60 )); then
      echo "ERROR: k3s node did not become Ready within 5 minutes" >&2
      exit 1
    fi
  done
  step_log 7 "k3s" "DONE"
}

# ---------------------------------------------------------------------------
# Step 8 — Install Tailscale
# ---------------------------------------------------------------------------
step8_tailscale() {
  if command -v tailscale >/dev/null 2>&1 && tailscale status 2>/dev/null | grep -qi "online\|active\|running"; then
    step_log 8 "tailscale" "SKIP"
    return
  fi
  step_log 8 "tailscale" "RUN"
  if ! command -v tailscale >/dev/null 2>&1; then
    curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.noarmor.gpg \
      | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
    curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.tailscale-keyring.list \
      | tee /etc/apt/sources.list.d/tailscale.list >/dev/null
    apt-get update -qq
    apt-get install -y -qq tailscale
  fi
  systemctl enable --now tailscaled
  echo "  Running 'tailscale up' — operator must click the printed URL to authenticate."
  tailscale up --hostname="$TAILSCALE_HOSTNAME" --accept-routes
  local tries=0
  until tailscale status 2>/dev/null | grep -qi "online\|active\|running"; do
    sleep 5
    tries=$((tries+1))
    if (( tries > 60 )); then
      echo "ERROR: tailscale did not come online within 5 minutes" >&2
      exit 1
    fi
  done
  step_log 8 "tailscale" "DONE"
}

# ---------------------------------------------------------------------------
# Step 9 — SSH router user + Ed25519 keypair
# ---------------------------------------------------------------------------
step9_ssh_router() {
  step_log 9 "ssh-router" "RUN"

  # Create router user
  if ! id router >/dev/null 2>&1; then
    useradd -r -m -d /home/router -s /usr/sbin/nologin router
  fi

  # Copy ssh-router.sh (root-owned, not writable by router)
  local router_script_src="${REPO_ROOT}/infra/olympia/ssh-router.sh"
  if [[ ! -f "$router_script_src" ]]; then
    echo "ERROR: missing $router_script_src" >&2
    exit 1
  fi
  cp "$router_script_src" /home/router/ssh-router.sh
  chmod 0755 /home/router/ssh-router.sh
  chown root:root /home/router/ssh-router.sh

  # Apply ssh-router ServiceAccount + RBAC
  run_kubectl apply -f - <<'EOF'
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ssh-router
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ssh-router
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ssh-router
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ssh-router
subjects:
- kind: ServiceAccount
  name: ssh-router
  namespace: kube-system
EOF

  # Build router kubeconfig bound to the ssh-router SA token.
  mkdir -p /home/router/.kube
  local sa_token api_server ca_b64
  sa_token="$(run_kubectl create token ssh-router -n kube-system --duration=8760h 2>/dev/null \
    || run_kubectl -n kube-system create token ssh-router --duration=8760h)"
  api_server="$(run_kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.server}')"
  ca_b64="$(run_kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')"
  if [[ -z "$ca_b64" ]]; then
    ca_b64="$(base64 -w0 /var/lib/rancher/k3s/server/tls/server-ca.crt 2>/dev/null || true)"
  fi
  cat > /home/router/.kube/config <<EOF
apiVersion: v1
kind: Config
clusters:
- name: olympia
  cluster:
    server: ${api_server}
    certificate-authority-data: ${ca_b64}
contexts:
- name: ssh-router@olympia
  context:
    cluster: olympia
    user: ssh-router
current-context: ssh-router@olympia
users:
- name: ssh-router
  user:
    token: ${sa_token}
EOF
  chmod 0600 /home/router/.kube/config
  chown -R router:router /home/router/.kube

  # Generate Ed25519 keypair if absent (root-owned).
  if [[ ! -f /root/easyshell-router-key ]]; then
    ssh-keygen -t ed25519 -N "" -C "easyshell-session-manager" -f /root/easyshell-router-key
    chmod 0600 /root/easyshell-router-key
    chmod 0644 /root/easyshell-router-key.pub
  fi

  # Install pubkey to router authorized_keys (forced command, no forwarding).
  mkdir -p /home/router/.ssh
  local pubkey authline
  pubkey="$(cat /root/easyshell-router-key.pub)"
  authline="command=\"/home/router/ssh-router.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ${pubkey}"
  touch /home/router/.ssh/authorized_keys
  if ! grep -qF "$pubkey" /home/router/.ssh/authorized_keys 2>/dev/null; then
    echo "$authline" >> /home/router/.ssh/authorized_keys
  fi
  chmod 0700 /home/router/.ssh
  chmod 0600 /home/router/.ssh/authorized_keys
  chown -R router:router /home/router/.ssh

  step_log 9 "ssh-router" "DONE"
}

# ---------------------------------------------------------------------------
# Step 10 — Apply registry + htpasswd Secret
# ---------------------------------------------------------------------------
step10_registry() {
  step_log 10 "registry" "RUN"
  run_kubectl apply -f "${REPO_ROOT}/infra/olympia/registry/"
  htpasswd -Bbn "$REGISTRY_USERNAME" "$REGISTRY_PASSWORD" \
    | run_kubectl create secret generic registry-htpasswd \
        -n registry \
        --from-file=htpasswd=/dev/stdin \
        --dry-run=client -o yaml \
    | run_kubectl apply -f -
  run_kubectl wait --for=condition=Ready pod -l app=registry -n registry --timeout=120s
  step_log 10 "registry" "DONE"
}

# ---------------------------------------------------------------------------
# Step 11 — kube-system/registry-creds
# ---------------------------------------------------------------------------
step11_registry_creds() {
  step_log 11 "registry-creds" "RUN"
  run_kubectl create secret docker-registry registry-creds \
    -n kube-system \
    --docker-server=registry.registry.svc.cluster.local:5000 \
    --docker-username="$REGISTRY_USERNAME" \
    --docker-password="$REGISTRY_PASSWORD" \
    --dry-run=client -o yaml \
    | run_kubectl apply -f -
  step_log 11 "registry-creds" "DONE"
}

# ---------------------------------------------------------------------------
# Step 12 — GC controller (image pulled from ghcr.io)
# ---------------------------------------------------------------------------
step12_gc_controller() {
  step_log 12 "gc-controller" "RUN"
  run_kubectl create namespace gc-system --dry-run=client -o yaml | run_kubectl apply -f -

  run_kubectl create secret docker-registry ghcr-creds \
    -n gc-system \
    --docker-server=ghcr.io \
    --docker-username="$GHCR_USERNAME" \
    --docker-password="$GHCR_TOKEN" \
    --dry-run=client -o yaml \
    | run_kubectl apply -f -

  run_kubectl apply -f "${REPO_ROOT}/infra/olympia/gc-controller/manifests/rbac.yaml"

  GITHUB_OWNER="$GITHUB_OWNER" GC_IMAGE_TAG="$GC_IMAGE_TAG" \
    envsubst < "${REPO_ROOT}/infra/olympia/gc-controller/manifests/deployment.yaml" \
    | run_kubectl apply -f -

  run_kubectl wait --for=condition=Ready pod -l app=gc-controller -n gc-system --timeout=120s
  step_log 12 "gc-controller" "DONE"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print_summary() {
  echo
  echo "============================================================"
  echo "  olympia provisioning complete"
  echo "============================================================"
  for key in $(printf '%s\n' "${!STEP_STATUS[@]}" | sort -n); do
    printf '  %s -> %s\n' "$key" "${STEP_STATUS[$key]}"
  done
  echo
  if command -v tailscale >/dev/null 2>&1; then
    echo "[Tailscale hostname]: ${TAILSCALE_HOSTNAME}"
    echo "[Tailscale IP]: $(tailscale ip -4 2>/dev/null | head -1 || echo 'unknown')"
  fi
  echo "[Registry endpoint]: registry.registry.svc.cluster.local:5000"
  echo "[GC pod]: $(KUBECONFIG="$KUBECONFIG_PATH" kubectl -n gc-system get pod -l app=gc-controller -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo 'unknown')"
  echo "[SSH router pubkey fingerprint]: $(ssh-keygen -lf /root/easyshell-router-key.pub)"
  echo "[Privkey path]: /root/easyshell-router-key (transfer to prod session-manager out-of-band; this file will NOT persist beyond the VPS)"
  echo
  echo "Next: run 'make -C infra/olympia/multipass smoke' to verify the flow."
}

main() {
  step1_preflight
  step2_kernel
  step3_swap
  step4_ufw
  step5_apt
  step6_registries
  step7_k3s
  step8_tailscale
  step9_ssh_router
  step10_registry
  step11_registry_creds
  step12_gc_controller
  print_summary
}

main "$@"
