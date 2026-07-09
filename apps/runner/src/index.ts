import fs from "node:fs"
import path from "node:path"
import { createHTTPServer } from "@trpc/server/adapters/standalone"

import { createLogger } from "@easyshell/logger"

import { createContext } from "./context"
import { migrate } from "./db/migrations"
import { getDb } from "./db/sqlite"
import { env } from "./env"
import { appRouter } from "./router"
import { getCapacity } from "./services/capacity"
import { heartbeatLoop } from "./workers/heartbeat"
import { pushRetryLoop } from "./workers/push-retry"
import { startReconciliation } from "./workers/reconciliation"
import { runRecovery } from "./workers/recovery"

const log = createLogger("runner", { env: env.NODE_ENV })

async function main(): Promise<void> {
  for (const sub of ["sessions", "submissions"]) {
    const dir = path.join(env.WORKING_DIR, sub)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const dbDir = path.dirname(env.RUNNER_DB_PATH)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const db = getDb(env.RUNNER_DB_PATH)
  migrate(db)

  // Reconcile SQLite ↔ docker once before exposing capacity to the coordinator.
  await runRecovery()

  // Periodic 30s reconciliation sweep — non-blocking.
  startReconciliation()

  // Heartbeat loop — non-blocking. Reads live counters from services/capacity.ts.
  heartbeatLoop(getCapacity).catch((err: unknown) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "heartbeat-loop crashed",
    )
  })

  // push-retry loop — non-blocking. Replays terminal job statuses to the
  // coordinator until acked.
  pushRetryLoop().catch((err: unknown) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "push-retry-loop crashed",
    )
  })

  const server = createHTTPServer({
    router: appRouter,
    createContext,
    onError({ error, path: p }) {
      if (error.message === "not implemented") return
      log.error({ path: p, err: error }, "tRPC error")
    },
  })

  server.listen(env.RUNNER_PORT, () => {
    log.info({ port: env.RUNNER_PORT }, "runner listening")
  })
}

main().catch((err: unknown) => {
  log.error(
    { err: err instanceof Error ? err.message : String(err) },
    "runner.boot.failed",
  )
  process.exit(1)
})
