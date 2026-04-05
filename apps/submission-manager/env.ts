import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **submission-manager** app (`@easyshell/submission-manager`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    DOCKER_REGISTRY: z.string().optional(),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
    MUSTANG_URL: z.string().url(),
    MUSTANG_TOKEN: z.string(),
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
