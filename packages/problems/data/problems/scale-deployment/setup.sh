#!/bin/bash
set -euo pipefail

# Manifests are pre-baked into /var/lib/rancher/k3s/server/manifests/ and
# auto-applied by k3s on startup. This script waits for the deploy controller
# to create the resources, then waits for the deployment rollout to complete
# before signaling readiness.

# Wait for the deployment to be created by the k3s deploy controller
echo "Waiting for deployment to be created..."
timeout=60
elapsed=0
until kubectl get deployment scale-app -n q34 &>/dev/null; do
	if [ "$elapsed" -ge "$timeout" ]; then
		echo "Timed out waiting for deployment to be created"
		exit 1
	fi
	sleep 1
	elapsed=$((elapsed + 1))
done

echo "Deployment found, waiting for rollout..."
kubectl rollout status deployment/scale-app -n q34 --timeout=120s

echo "Setup complete for scale-deployment"
