import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **cron** service (`@easyshell/cron`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    MUSTANG_URL: z.string().url(),
    MUSTANG_TOKEN: z.string(),
    /** How often to run the cleanup job (cron expression). Defaults to every 5 minutes. */
    CLEANUP_SCHEDULE: z.string().default("*/5 * * * *"),
    /** How often to run the pool reconciliation job (cron expression). Defaults to every 2 minutes. */
    POOL_SCHEDULE: z.string().default("*/2 * * * *"),
    /** Grace period (in seconds) before an orphaned container is killed. Defaults to 300 (5 minutes). */
    ORPHAN_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(300),
  },
  onValidationError: (issues) => {
    const details = issues
      .map((issue) => {
        const path =
          issue.path
            ?.map((p) => (typeof p === "object" ? String(p.key) : String(p)))
            .join(".") ?? "unknown"
        const message = issue.message ?? "invalid"
        return `  - ${path}: ${message}`
      })
      .join("\n")
    console.error(`\n❌ Invalid environment variables:\n${details}\n`)
    throw new Error(`Invalid environment variables:\n${details}`)
  },
  runtimeEnv: {
    ...process.env,
    MUSTANG_URL: process.env.MUSTANG_URL || process.env.SESSION_MANAGER_URL,
    MUSTANG_TOKEN:
      process.env.MUSTANG_TOKEN || process.env.SESSION_MANAGER_TOKEN,
  },
  emptyStringAsUndefined: true,
})
