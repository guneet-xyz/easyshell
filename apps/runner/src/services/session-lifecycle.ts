import { getDb } from "../db/sqlite"
import { decrementSession } from "./capacity"

/**
 * Mark a session container as ended and queue its cleanup. The session
 * capacity slot is released only on the first transition, and only if the
 * session had started (a slot is taken when `create` promotes it to running),
 * so repeated kills, expiry and reconciliation never double-count.
 */
export function endSession(
  db: ReturnType<typeof getDb>,
  containerName: string,
  jobStatus: "cancelled" | "lost",
  // Must match the cleanup_pending.reason CHECK constraint.
  reason: "cancelled" | "orphaned",
  errorMessage?: string,
): boolean {
  const previous = db
    .prepare("SELECT docker_state FROM container WHERE container_name=?")
    .get(containerName) as { docker_state: string } | undefined
  const changed = db
    .prepare(
      "UPDATE container SET docker_state='removed' WHERE container_name=? AND docker_state != 'removed'",
    )
    .run(containerName).changes
  db.prepare(
    `UPDATE accepted_job SET status=?, finished_at=?, error_message=COALESCE(?, error_message)
      WHERE container_name=? AND status IN ('accepted','starting','running')`,
  ).run(jobStatus, Date.now(), errorMessage ?? null, containerName)
  db.prepare(
    "INSERT OR IGNORE INTO cleanup_pending (container_name, reason, queued_at) VALUES (?,?,?)",
  ).run(containerName, reason, Date.now())
  if (changed > 0 && previous?.docker_state === "running") decrementSession()
  return changed > 0
}
