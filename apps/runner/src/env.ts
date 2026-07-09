import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    RUNNER_PORT: z.coerce.number().int().positive().default(4200),
    RUNNER_NAME: z.string().min(1),
    RUNNER_PUBLIC_URL: z.string().url(),
    RUNNER_REGION: z.string().optional(),
    RUNNER_LABELS: z
      .string()
      .default("{}")
      .transform((s) => JSON.parse(s) as Record<string, string>),
    RUNNER_ID: z.string().min(1),
    RUNNER_TOKEN: z.string().min(1),
    COORDINATOR_URL: z.string().url(),
    DOCKER_REGISTRY: z.string().optional(),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
    SUBMISSION_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
    SESSION_MAX_CONCURRENCY: z.coerce.number().int().positive().default(64),
    RUNNER_DB_PATH: z.string().default("/var/lib/easyshell-runner/runner.db"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
