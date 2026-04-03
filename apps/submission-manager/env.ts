import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **submission-manager** app (`@easyshell/submission-manager`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    DOCKER_REGISTRY: z.string().optional(),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
