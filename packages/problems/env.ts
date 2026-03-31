import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for **problems** scripts (`@easyshell/problems`). */
export const env = createEnv({
  server: {
    DOCKER_REGISTRY: z.string().default(""),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
    PARALLEL_LIMIT: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 5)),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
