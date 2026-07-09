import { createHTTPServer } from "@trpc/server/adapters/standalone"

import { createLogger } from "@easyshell/logger"

import { createContext } from "./context"
import { env } from "./env"
import { appRouter } from "./router"
import { assertMigrationsApplied } from "./services/schema-check"
import { startQueuePoller } from "./workers/queue-poller"
import { startWatchdog } from "./workers/watchdog"

const log = createLogger("coordinator", { env: env.NODE_ENV })

async function main(): Promise<void> {
  await assertMigrationsApplied()

  const server = createHTTPServer({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (error.code !== "INTERNAL_SERVER_ERROR") return
      // suppress "not implemented" noise from the stub procedures
      if (error.message === "not implemented") return
      log.error({ path, err: error }, "tRPC error")
    },
  })

  startWatchdog()

  startQueuePoller().catch((err: unknown) => {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "queue-poller crashed",
    )
  })

  server.listen(env.COORDINATOR_PORT, () => {
    log.info({ port: env.COORDINATOR_PORT }, "coordinator listening")
  })
}

main().catch((err: unknown) => {
  log.fatal(
    { error: err instanceof Error ? err.message : String(err) },
    "coordinator.boot.unhandled — unhandled error during boot",
  )
  process.exit(1)
})
