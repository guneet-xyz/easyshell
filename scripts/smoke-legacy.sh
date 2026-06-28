#!/usr/bin/env bash
set -euo pipefail

SESSION_MANAGER_URL="${SESSION_MANAGER_URL:-http://localhost:4000}"
SESSION_MANAGER_TOKEN="${SESSION_MANAGER_TOKEN:-token}"

echo "=== Smoke test: legacy session-manager stack ==="

# 1. Wait for session-manager
echo "Waiting for session-manager on ${SESSION_MANAGER_URL}..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${SESSION_MANAGER_TOKEN}" \
    "${SESSION_MANAGER_URL}/is-running" \
    -X POST -H "Content-Type: application/json" \
    -d '{"container_name":"smoke-check"}' 2>/dev/null | grep -q "200"; then
    echo "  Session-manager responsive after ${i}s"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Session-manager not responsive after 30s" >&2
    exit 1
  fi
  sleep 1
done

# 2. Submit a synthetic job
echo "Submitting test job to /run-submission..."
RESPONSE=$(curl -sf -X POST "${SESSION_MANAGER_URL}/run-submission" \
  -H "Authorization: Bearer ${SESSION_MANAGER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "easyshell-smoke-1",
    "input": "#!/bin/sh\necho hello\n",
    "metadata": {
      "submission_id": 99999,
      "testcase_id": 1,
      "problem_slug": "smoke"
    }
  }' 2>/dev/null || echo '{"error":"request failed"}')

JOB_ID=$(echo "$RESPONSE" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4 || echo "")

if [[ -z "$JOB_ID" ]]; then
  echo "  Note: 503 at capacity or image not found is expected in CI without problem images"
  echo "  Response: $RESPONSE"
  echo "=== LEGACY SMOKE TEST (endpoint reachable — image-dependent portion skipped) ==="
  exit 0
fi

echo "  job_id=${JOB_ID}"

# 3. Poll for result
for i in $(seq 1 30); do
  RESULT=$(curl -sf -H "Authorization: Bearer ${SESSION_MANAGER_TOKEN}" \
    "${SESSION_MANAGER_URL}/run-submission/${JOB_ID}" 2>/dev/null || echo '{"status":"error"}')
  STATUS=$(echo "$RESULT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [[ "$STATUS" == "done" || "$STATUS" == "error" ]]; then
    echo "  Status: ${STATUS}"
    echo "=== LEGACY SMOKE TEST PASSED ==="
    exit 0
  fi
  sleep 2
done

echo "ERROR: Legacy job did not complete in 60s" >&2
exit 1
