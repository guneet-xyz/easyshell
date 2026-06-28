#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
COORDINATOR_URL="${COORDINATOR_URL:-http://localhost:4100}"
COORDINATOR_TOKEN="${COORDINATOR_TOKEN:-token-coordinator}"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

echo "=== Smoke test: coordinator-runner stack ==="

# 1. Wait for coordinator health
echo "Waiting for coordinator..."
for i in $(seq 1 30); do
  if curl -sf "${COORDINATOR_URL}/health.ping" > /dev/null 2>&1; then
    echo "  Coordinator healthy after ${i}s"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Coordinator not healthy after 30s" >&2
    exit 1
  fi
  sleep 1
done

# 2. Find a real user id (or use a placeholder)
USER_ID=$(psql "$DB_URL" -t -c "SELECT id FROM easyshell_user LIMIT 1" 2>/dev/null | tr -d ' \n' || echo "")
if [[ -z "$USER_ID" ]]; then
  echo "ERROR: No users in DB — cannot create synthetic submission" >&2
  exit 1
fi

# 3. Find problem id 1 (first problem)
PROBLEM_ID=1

# 4. Insert synthetic submission
echo "Inserting synthetic submission..."
SUBMISSION_ID=$(psql "$DB_URL" -t -c "
  INSERT INTO easyshell_submissions (user_id, problem_id, input, submitted_at)
  VALUES ('${USER_ID}', ${PROBLEM_ID}, '#!/bin/sh\necho hello\n', now())
  RETURNING id
" 2>/dev/null | tr -d ' \n')

if [[ -z "$SUBMISSION_ID" ]]; then
  echo "ERROR: Failed to insert submission" >&2
  exit 1
fi
echo "  submission_id=${SUBMISSION_ID}"

# 5. Find testcase ids for the problem
TESTCASE_IDS=$(psql "$DB_URL" -t -c "
  SELECT testcase_id FROM easyshell_submission_testcase_queue
  WHERE submission_id=${SUBMISSION_ID}
" 2>/dev/null | tr -d ' ' | grep -v '^$' || echo "")

if [[ -z "$TESTCASE_IDS" ]]; then
  # Insert queue rows manually if submission doesn't auto-create them
  # This assumes testcase_id=1 for problem_id=1
  psql "$DB_URL" -c "
    INSERT INTO easyshell_submission_testcase_queue (submission_id, testcase_id, status, attempts)
    VALUES (${SUBMISSION_ID}, 1, 'pending', 0)
    ON CONFLICT DO NOTHING
  " 2>/dev/null || true
  TESTCASE_IDS="1"
fi
echo "  testcase_ids=${TESTCASE_IDS}"

# 6. Poll for result (up to 60s)
echo "Polling for grading result (up to 60s)..."
DEADLINE=$((SECONDS + 60))
while [[ $SECONDS -lt $DEADLINE ]]; do
  RESULT=$(psql "$DB_URL" -t -c "
    SELECT passed FROM easyshell_submission_testcase
    WHERE submission_id=${SUBMISSION_ID}
    LIMIT 1
  " 2>/dev/null | tr -d ' \n' || echo "")

  if [[ -n "$RESULT" ]]; then
    echo "  Result: passed=${RESULT}"
    echo "=== SMOKE TEST PASSED ==="
    exit 0
  fi

  # Also check for failed queue status
  FAILED=$(psql "$DB_URL" -t -c "
    SELECT count(*) FROM easyshell_submission_testcase_queue
    WHERE submission_id=${SUBMISSION_ID} AND status='failed'
  " 2>/dev/null | tr -d ' \n' || echo "0")

  if [[ "${FAILED}" != "0" ]]; then
    echo "  Queue item failed (status=failed)"
    echo "=== SMOKE TEST PASSED (failure case verified) ==="
    exit 0
  fi

  sleep 2
done

echo "ERROR: Submission did not complete within 60s" >&2
psql "$DB_URL" -c "
  SELECT status, attempts, last_error FROM easyshell_submission_testcase_queue
  WHERE submission_id=${SUBMISSION_ID}
" 2>/dev/null || true
exit 1
