// ==========================================
// Periodic reconciliation worker.
//
// Runs every 30s for the lifetime of the runner. Same shape as the
// boot-time recovery worker but lighter: it only flips live in-flight
// rows whose containers have silently vanished (crashed daemon, OOM
// kill, manual `docker rm`, etc.) and enqueues them for cleanup. The
// push-retry loop relays the resulting `lost` rows to the coordinator.
//
// The in-memory capacity counters are NOT touched here — for
// submission jobs the dockerRun finally{} in jobs.ts already
// decrements when the process exits. Session counters are tracked at
// the create/kill router boundary; a stale counter for a crashed
// session container is an accepted tradeoff for T22 (informational
// only; heartbeat re-publishes every 5s).
// ==========================================

import { createLogger } from "@easyshell/logger"

import { getDb } from "../db/sqlite"
import { dockerInspect } from "../docker/cli"
import { env } from "../env"

const log = createLogger("runner:reconciliation")

const SCAN_INTERVAL_MS = 30_000

interface ActiveJobRow {
  job_id: string
  container_name: string
}

async function scanOnce(): Promise<void> {
  const db = getDb(env.RUNNER_DB_PATH)
  const active = db
    .prepare(
      "SELECT job_id, container_name FROM accepted_job WHERE status IN ('accepted','starting','running')",
    )
    .all() as ActiveJobRow[]

  if (active.length === 0) return

  for (const row of active) {
    try {
      const inspect = await dockerInspect(row.container_name)
      if (inspect.exists && inspect.running) continue

      db.prepare(
        "UPDATE accepted_job SET status='lost', error_message=?, finished_at=? WHERE job_id=?",
      ).run("container gone during reconciliation", Date.now(), row.job_id)
      db.prepare(
        "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
      ).run(row.container_name, "orphaned", Date.now())
      log.warn(
        { job_id: row.job_id, container_name: row.container_name },
        "reconciliation.orphan-marked-lost",
      )
    } catch (err: unknown) {
      log.error(
        {
          job_id: row.job_id,
          error: err instanceof Error ? err.message : String(err),
        },
        "reconciliation.inspect-failed",
      )
    }
  }
}

export function startReconciliation(): void {
  setInterval(() => {
    scanOnce().catch((err: unknown) => {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        "reconciliation.error",
      )
    })
  }, SCAN_INTERVAL_MS)
  log.info({ interval_ms: SCAN_INTERVAL_MS }, "reconciliation.started")
}
