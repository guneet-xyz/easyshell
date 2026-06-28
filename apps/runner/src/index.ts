import { createHTTPServer } from "@trpc/server/adapters/standalone"
import fs from "node:fs"
import path from "node:path"

import { createLogger } from "@easyshell/logger"

import { createContext } from "./context"
import { migrate } from "./db/migrations"
import { getDb } from "./db/sqlite"
import { env } from "./env"
import { appRouter } from "./router"

const log = createLogger("runner", { env: env.NODE_ENV })

for (const sub of ["sessions", "submissions"]) {
  const dir = path.join(env.WORKING_DIR, sub)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const dbDir = path.dirname(env.RUNNER_DB_PATH)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

const db = getDb(env.RUNNER_DB_PATH)
migrate(db)

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
