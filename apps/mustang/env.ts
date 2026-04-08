import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **mustang** service (`@easyshell/mustang-service`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    MUSTANG_TOKEN: z.string(),
    DOCKER_REGISTRY: z.string().default(""),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
    PORT: z.coerce.number().int().positive().default(4000),
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
    MUSTANG_TOKEN: process.env.MUSTANG_TOKEN || process.env.TOKEN,
  },
  emptyStringAsUndefined: true,
})
