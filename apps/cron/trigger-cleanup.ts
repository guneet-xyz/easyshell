/**
 * Manually trigger the cleanup job once and exit.
 * Usage: pnpm --filter @easyshell/cron trigger:cleanup
 */
import { createDb } from "@easyshell/db"
import { createMustangClient } from "@easyshell/mustang/client"

import { env } from "./env"
import { runCleanup } from "./jobs/cleanup"

const db = createDb(env.DATABASE_URL)
const client = createMustangClient({
  baseUrl: env.MUSTANG_URL,
  token: env.MUSTANG_TOKEN,
})

console.log("[trigger] running cleanup job...")
await runCleanup({
  db,
  client,
  orphanGraceSeconds: env.ORPHAN_GRACE_SECONDS,
})
console.log("[trigger] cleanup job complete")
process.exit(0)
