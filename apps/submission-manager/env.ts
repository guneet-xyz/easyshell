import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **submission-manager** app (`@easyshell/submission-manager`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    SESSION_MANAGER_URL: z.string().url(),
    SESSION_MANAGER_TOKEN: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
