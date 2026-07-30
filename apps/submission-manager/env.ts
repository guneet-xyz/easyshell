import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DOCKER_REGISTRY: z.string().default(""),
    DATABASE_URL: z.string().url(),
    WORKING_DIR: z.string().default("/tmp/easyshell"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
