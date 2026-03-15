import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **submission-manager** app (`@easyshell/submission-manager`). */
export const env = createEnv({
  server: {
    DRIZZLE_PROXY_URL: z.string().url(),
    DRIZZLE_PROXY_TOKEN: z.string(),
    DOCKER_REGISTRY: z.string().default(""),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
