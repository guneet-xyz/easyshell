import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **coordinator** app (`@easyshell/coordinator`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    COORDINATOR_TOKEN: z.string().min(1),
    COORDINATOR_REGISTRATION_TOKEN: z.string().min(1),
    COORDINATOR_PORT: z.coerce.number().int().positive().default(4100),
    MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // 32-byte hex for AES-256-GCM; optional so scaffold boots without it.
    COORDINATOR_SECRET_KEY: z.string().length(64).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
