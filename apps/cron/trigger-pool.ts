/**
 * Manually trigger the pool reconciliation job once and exit.
 * Usage: pnpm --filter @easyshell/cron trigger:pool
 */
import { createMustangClient } from "@easyshell/mustang/client"

import { env } from "./env"
import { runPoolReconciliation } from "./jobs/pool"

const client = createMustangClient({
  baseUrl: env.MUSTANG_URL,
  token: env.MUSTANG_TOKEN,
})

console.log("[trigger] running pool reconciliation job...")
await runPoolReconciliation({ client })
console.log("[trigger] pool reconciliation complete")
process.exit(0)
