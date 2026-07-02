// ==========================================
// Boot-time recovery worker.
//
// Runs ONCE at startup, AFTER bootstrap completes. Walks every
// non-terminal `accepted_job` row and reconciles its in-memory truth
// against `docker inspect`:
//
//   container missing       → mark accepted_job=lost,  cleanup_pending
//   container present, up   → mark accepted_job=running (preserves any
//                             accepted/starting rows that survived the
//                             restart; SQLite + docker agree → resume)
//   container present, down → mark accepted_job=lost,  cleanup_pending
//
// Then drains `cleanup_pending` (attempts<3) by removing the container
// and rm -rf'ing both possible working-dir trees (submissions/sessions
// share the cleanup path because the container name is the only key).
//
// All terminal-status transitions are picked up by push-retry.ts (T19)
// on its next tick — this worker does NOT call the coordinator itself.
// ==========================================

import fs from "node:fs"
import path from "node:path"

import { createLogger } from "@easyshell/logger"

import { getDb } from "../db/sqlite"
import { dockerInspect, dockerRm } from "../docker/cli"
import { env } from "../env"

const log = createLogger("runner:recovery")

interface OrphanedJobRow {
  job_id: string
  container_name: string
  status: string
}

interface CleanupRow {
  container_name: string
  reason: string
}

const MAX_CLEANUP_ATTEMPTS = 3

export async function runRecovery(): Promise<void> {
  const db = getDb(env.RUNNER_DB_PATH)
  log.info("runner.recovery.starting")

  const orphaned = db
    .prepare(
      "SELECT job_id, container_name, status FROM accepted_job WHERE status IN ('accepted','starting','running')",
    )
    .all() as OrphanedJobRow[]

  if (orphaned.length === 0) {
    log.info("runner.recovery.no-orphans")
  } else {
    log.info({ count: orphaned.length }, "runner.recovery.scanning-orphans")

    for (const row of orphaned) {
      try {
        const inspect = await dockerInspect(row.container_name)

        if (!inspect.exists) {
          db.prepare(
            "UPDATE accepted_job SET status='lost', error_message=?, finished_at=? WHERE job_id=?",
          ).run(
            "container disappeared during runner downtime",
            Date.now(),
            row.job_id,
          )
          db.prepare(
            "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
          ).run(row.container_name, "startup_recovery", Date.now())
          log.warn(
            { job_id: row.job_id, container_name: row.container_name },
            "runner.recovery.orphan-marked-lost",
          )
          continue
        }

        if (inspect.running) {
          log.info(
            { job_id: row.job_id, container_name: row.container_name },
            "runner.recovery.container-still-running",
          )
          // Container is still alive. Promote accepted/starting rows to
          // running so jobs.get reflects reality. Rows already at
          // 'running' are unchanged (the WHERE filter excludes them).
          db.prepare(
            "UPDATE accepted_job SET status='running' WHERE job_id=? AND status IN ('accepted','starting')",
          ).run(row.job_id)
          continue
        }

        // exists && !running → exited during downtime → lost
        db.prepare(
          "UPDATE accepted_job SET status='lost', error_message=?, finished_at=? WHERE job_id=?",
        ).run("container exited during runner downtime", Date.now(), row.job_id)
        db.prepare(
          "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
        ).run(row.container_name, "startup_recovery", Date.now())
        log.warn(
          { job_id: row.job_id, container_name: row.container_name },
          "runner.recovery.exited-orphan-marked-lost",
        )
      } catch (err: unknown) {
        log.error(
          {
            job_id: row.job_id,
            error: err instanceof Error ? err.message : String(err),
          },
          "runner.recovery.inspect-failed",
        )
      }
    }
  }

  await drainCleanupQueue(db)

  log.info("runner.recovery.complete")
}

async function drainCleanupQueue(db: ReturnType<typeof getDb>): Promise<void> {
  const pending = db
    .prepare(
      "SELECT container_name, reason FROM cleanup_pending WHERE attempts < ?",
    )
    .all(MAX_CLEANUP_ATTEMPTS) as CleanupRow[]

  if (pending.length === 0) return

  log.info({ count: pending.length }, "runner.recovery.draining-cleanup-queue")

  for (const item of pending) {
    try {
      await dockerRm(item.container_name)

      const submissionDir = path.join(
        env.WORKING_DIR,
        "submissions",
        item.container_name,
      )
      if (fs.existsSync(submissionDir)) {
        fs.rmSync(submissionDir, { recursive: true, force: true })
      }

      const sessionDir = path.join(
        env.WORKING_DIR,
        "sessions",
        item.container_name,
      )
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
      }

      db.prepare("DELETE FROM cleanup_pending WHERE container_name=?").run(
        item.container_name,
      )
      log.debug(
        { container_name: item.container_name, reason: item.reason },
        "runner.recovery.cleanup-ok",
      )
    } catch (err: unknown) {
      db.prepare(
        "UPDATE cleanup_pending SET attempts=attempts+1, last_attempt_at=? WHERE container_name=?",
      ).run(Date.now(), item.container_name)
      log.warn(
        {
          container_name: item.container_name,
          error: err instanceof Error ? err.message : String(err),
        },
        "runner.recovery.cleanup-failed",
      )
    }
  }
}
