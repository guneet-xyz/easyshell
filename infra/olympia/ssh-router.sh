#!/usr/bin/env bash
set -euo pipefail
IFS=$' \t\n'

# Olympia SSH router: command="..." restricted entry point in authorized_keys.
# Validates SSH_ORIGINAL_COMMAND and execs into a session pod via kubectl.
# Never echo user input back to logs (info leak). All rejects: "invalid request" -> exit 2.

reject() {
  echo "invalid request" >&2
  exit 2
}

cmd="${SSH_ORIGINAL_COMMAND:-}"

# 1. Empty command -> reject
[[ -n "$cmd" ]] || reject

# 2. Metacharacter reject: ; & | $ ( ) < > backtick backslash newline CR
if [[ "$cmd" == *';'* ]] || [[ "$cmd" == *'&'* ]] || [[ "$cmd" == *'|'* ]] \
   || [[ "$cmd" == *'$'* ]] || [[ "$cmd" == *'('* ]] || [[ "$cmd" == *')'* ]] \
   || [[ "$cmd" == *'<'* ]] || [[ "$cmd" == *'>'* ]] || [[ "$cmd" == *'`'* ]] \
   || [[ "$cmd" == *'\'* ]] || [[ "$cmd" == *$'\n'* ]] || [[ "$cmd" == *$'\r'* ]]; then
  reject
fi

# 3. Split into exactly two whitespace-separated tokens
read -r -a tokens <<< "$cmd"
[[ "${#tokens[@]}" -eq 2 ]] || reject

ns="${tokens[0]}"
pod="${tokens[1]}"

# 4. Validate namespace pattern
[[ "$ns" =~ ^session-[a-z0-9]{8}$ ]] || reject

# 5. Validate pod pattern
[[ "$pod" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] || reject

# 6. Verify namespace has easyshell.sh/session=true label
label=$(KUBECONFIG=/home/router/.kube/config kubectl get ns "$ns" -o jsonpath='{.metadata.labels.easyshell\.sh/session}' 2>/dev/null)
[[ "$label" == "true" ]] || reject

# 7. Verify pod phase
phase=$(KUBECONFIG=/home/router/.kube/config kubectl get pod "$pod" -n "$ns" -o jsonpath='{.status.phase}' 2>/dev/null)
if [[ "$phase" == "Pending" ]]; then
  KUBECONFIG=/home/router/.kube/config kubectl wait --for=condition=Ready pod/"$pod" -n "$ns" --timeout=10s 2>/dev/null || reject
elif [[ "$phase" != "Running" ]]; then
  reject
fi

# 8. Hand off to kubectl exec (exec so signal/exit propagate correctly)
exec KUBECONFIG=/home/router/.kube/config kubectl exec -it -n "$ns" "$pod" -- /bin/sh
