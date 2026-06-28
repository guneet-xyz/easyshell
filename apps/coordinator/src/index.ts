import { createHTTPServer } from "@trpc/server/adapters/standalone"

import { createLogger } from "@easyshell/logger"

import { createContext } from "./context"
import { env } from "./env"
import { appRouter } from "./router"

const log = createLogger("coordinator", { env: env.NODE_ENV })

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

server.listen(env.COORDINATOR_PORT, () => {
  log.info({ port: env.COORDINATOR_PORT }, "coordinator listening")
})
