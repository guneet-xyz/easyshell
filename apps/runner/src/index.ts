import fs from "node:fs"
import path from "node:path"

import { createHTTPServer } from "@trpc/server/adapters/standalone"

import { createLogger } from "@easyshell/logger"

import { createContext } from "./context"
import { migrate } from "./db/migrations"
import { getDb } from "./db/sqlite"
import { env } from "./env"
import { appRouter } from "./router"
import { bootstrap } from "./workers/bootstrap"
import { heartbeatLoop } from "./workers/heartbeat"
import { pushRetryLoop } from "./workers/push-retry"

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

  // 1. Bootstrap — exits process if RUNNER_ID/RUNNER_SECRET are not set (first-boot registration).
  await bootstrap()

  // 2. Start heartbeat loop in the background — non-blocking. T22 will replace the
  //    placeholder capacity snapshot with a live in-memory counter.
  heartbeatLoop(() => ({
    session_used: 0,
    session_max: env.SESSION_MAX_CONCURRENCY,
    submission_used: 0,
    submission_max: env.SUBMISSION_MAX_CONCURRENCY,
  })).catch((err: unknown) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "heartbeat-loop crashed",
    )
  })

  // 3. Start push-retry loop in the background — non-blocking. Replays terminal
  //    job statuses (succeeded/failed/cancelled) to the coordinator via
  //    jobs.reportResult until they are ack'd. Exits cleanly if RUNNER_ID or
  //    RUNNER_SECRET are missing.
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
