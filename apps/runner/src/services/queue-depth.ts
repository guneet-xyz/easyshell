import { createLogger } from "@easyshell/logger"

import { getDb } from "../db/sqlite"
import { env } from "../env"

const log = createLogger("runner:queue-depth")

export async function safePendingPushDepth(): Promise<number | "unknown"> {
  try {
    const db = getDb(env.RUNNER_DB_PATH)
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM accepted_job WHERE status IN ('succeeded','failed','cancelled') AND push_acked = 0`,
      )
      .get() as { count: number } | undefined
    return row?.count ?? 0
  } catch (err: unknown) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      "runner.auth.blocked.queue-depth-failed",
    )
    return "unknown"
  }
}
