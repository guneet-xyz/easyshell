import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **submission-manager** app (`@easyshell/submission-manager`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    DOCKER_REGISTRY: z.string().optional(),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
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
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
