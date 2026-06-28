#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
MIN_JOBS_PER_RUNNER=3

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

echo "=== Multi-runner dispersion check ==="
echo "Checking that both runner-1 and runner-2 each received >= ${MIN_JOBS_PER_RUNNER} jobs..."

RESULT=$(psql "$DB_URL" -t -c "
  SELECT runner_id, count(*) as job_count
  FROM easyshell_execution_job
  WHERE dispatched_at > now() - interval '5 minutes'
  GROUP BY runner_id
  ORDER BY job_count DESC
" 2>/dev/null | sed 's/^[[:space:]]*//' | grep -v '^$' || echo "")

if [[ -z "$RESULT" ]]; then
  echo "ERROR: No recent execution_job rows found in the last 5 minutes" >&2
  echo "Hint: Run 20 test submissions first, then check dispersion" >&2
  exit 1
fi

echo "Runner job distribution:"
echo "$RESULT"

# Check that at least 2 runners exist with >= MIN_JOBS_PER_RUNNER
RUNNER_COUNT=$(echo "$RESULT" | awk -F'|' -v min="$MIN_JOBS_PER_RUNNER" '$2 >= min {count++} END {print count+0}')

if [[ "$RUNNER_COUNT" -lt 2 ]]; then
  echo "ERROR: Only ${RUNNER_COUNT} runner(s) have >= ${MIN_JOBS_PER_RUNNER} jobs" >&2
  echo "Expected at least 2 runners to share the load" >&2
  exit 1
fi

echo "=== DISPERSION CHECK PASSED: ${RUNNER_COUNT} runners each have >= ${MIN_JOBS_PER_RUNNER} jobs ==="
exit 0
