import { Cron } from "croner"

import { createDb } from "@easyshell/db"
import { createMustangClient } from "@easyshell/mustang/client"

import { env } from "./env"
import { runCleanup } from "./jobs/cleanup"
import { runPoolReconciliation } from "./jobs/pool"

const log = (...args: unknown[]) => console.log("[cron]", ...args)
const logError = (...args: unknown[]) => console.error("[cron]", ...args)

const db = createDb(env.DATABASE_URL)
const client = createMustangClient({
  baseUrl: env.MUSTANG_URL,
  token: env.MUSTANG_TOKEN,
})

// =============================================================================
// Cleanup Job — remove expired sessions and orphaned containers
// =============================================================================

const cleanupJob = new Cron(
  env.CLEANUP_SCHEDULE,
  { protect: true },
  async () => {
    try {
      await runCleanup({
        db,
        client,
        orphanGraceSeconds: env.ORPHAN_GRACE_SECONDS,
      })
    } catch (error) {
      logError("cleanup job failed:", error)
    }
  },
)

// =============================================================================
// Pool Reconciliation Job — maintain warm container pool
// =============================================================================

const poolJob = new Cron(env.POOL_SCHEDULE, { protect: true }, async () => {
  try {
    await runPoolReconciliation({ client })
  } catch (error) {
    logError("pool reconciliation job failed:", error)
  }
})

// =============================================================================
// Startup
// =============================================================================

log("cron service started")
log(`  cleanup schedule: ${env.CLEANUP_SCHEDULE}`)
log(`  pool schedule: ${env.POOL_SCHEDULE}`)
log(`  orphan grace period: ${env.ORPHAN_GRACE_SECONDS}s`)
log(`  mustang url: ${env.MUSTANG_URL}`)

// Run both jobs immediately on startup, then let the cron schedule take over
log("running initial cleanup...")
runCleanup({
  db,
  client,
  orphanGraceSeconds: env.ORPHAN_GRACE_SECONDS,
}).catch((error) => logError("initial cleanup failed:", error))

log("running initial pool reconciliation...")
runPoolReconciliation({ client }).catch((error) =>
  logError("initial pool reconciliation failed:", error),
)

// Keep the process alive
// The Cron instances keep internal timers, so the process won't exit on its own.
// But we handle SIGTERM/SIGINT gracefully for Docker deployments.
function shutdown() {
  log("shutting down...")
  cleanupJob.stop()
  poolJob.stop()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
