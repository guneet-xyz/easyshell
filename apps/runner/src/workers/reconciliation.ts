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
import { dockerInspect, dockerKill, listExpiredSessions } from "../docker/cli"
import { env } from "../env"
import { isSubmissionInFlight } from "../services/in-flight"
import { endSession } from "../services/session-lifecycle"
import { drainCleanupQueue } from "./recovery"

const log = createLogger("runner:reconciliation")

const SCAN_INTERVAL_MS = 30_000

interface ActiveJobRow {
  job_id: string
  container_name: string
  mode: "session" | "submission"
}

export async function scanOnce(): Promise<void> {
  const db = getDb(env.RUNNER_DB_PATH)
  const active = db
    .prepare(
      "SELECT job_id, container_name, mode FROM accepted_job WHERE status IN ('accepted','starting','running')",
    )
    .all() as ActiveJobRow[]

  if (active.length === 0) return

  for (const row of active) {
    // Its docker run is still being awaited here and will record the outcome.
    if (row.mode === "submission" && isSubmissionInFlight(row.job_id)) continue
    try {
      const inspect = await dockerInspect(row.container_name)
      if (inspect.exists && inspect.running) continue

      if (row.mode === "session") {
        // Also releases the session capacity slot.
        endSession(
          db,
          row.container_name,
          "lost",
          "orphaned",
          "container gone during reconciliation",
        )
        log.warn(
          { job_id: row.job_id, container_name: row.container_name },
          "reconciliation.orphan-marked-lost",
        )
        continue
      }

      // Only if still active: the job may have finished during the inspect.
      const changed = db
        .prepare(
          "UPDATE accepted_job SET status='lost', error_message=?, finished_at=? WHERE job_id=? AND status IN ('accepted','starting','running')",
        )
        .run(
          "container gone during reconciliation",
          Date.now(),
          row.job_id,
        ).changes
      if (changed === 0) continue
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

/** Kill session containers past their expiry label (sessions last one hour). */
export async function reapExpiredSessions(): Promise<void> {
  const db = getDb(env.RUNNER_DB_PATH)
  for (const name of await listExpiredSessions()) {
    await dockerKill(name)
    endSession(db, name, "cancelled", "cancelled")
    log.info({ container_name: name }, "reconciliation.session-expired")
  }
}

async function tick(): Promise<void> {
  await scanOnce()
  await reapExpiredSessions()
  // Remove finished containers' working directories during normal operation,
  // not only at boot, so the shared work volume does not fill up.
  await drainCleanupQueue(getDb(env.RUNNER_DB_PATH))
}

export function startReconciliation(): void {
  setInterval(() => {
    tick().catch((err: unknown) => {
      log.error(
        { error: err instanceof Error ? err.message : String(err) },
        "reconciliation.error",
      )
    })
  }, SCAN_INTERVAL_MS)
  log.info({ interval_ms: SCAN_INTERVAL_MS }, "reconciliation.started")
}
