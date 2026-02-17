import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"), // TODO: do we need this?
    APP: z.enum(["website", "submission-manager", "script"]), // assert env.APP for correct types
    DOCKER_REGISTRY: z.string().default(""),
    WORKING_DIR: z.string().default("/tmp/easyshell"),

    ...(process.env.APP === "submission-manager"
      ? {
          DRIZZLE_PROXY_URL: z.string().url(),
          DRIZZLE_PROXY_TOKEN: z.string(),
        }
      : {}),

    ...(process.env.APP === "website"
      ? {
          DRIZZLE_PROXY_URL: z.string().url(),
          DRIZZLE_PROXY_TOKEN: z.string(),

          NEXTAUTH_SECRET: z.string(),
          NEXTAUTH_URL: z.string().url(),

          DISCORD_CLIENT_ID: z.string(),
          DISCORD_CLIENT_SECRET: z.string(),

          GITHUB_CLIENT_ID: z.string(),
          GITHUB_CLIENT_SECRET: z.string(),

          GOOGLE_CLIENT_ID: z.string(),
          GOOGLE_CLIENT_SECRET: z.string(),

          SESSION_MANAGER_URL: z.string().url(),
          SESSION_MANAGER_TOKEN: z.string(),

          RESEND_API_KEY: z.string(),
        }
      : {}),

    ...(process.env.APP === "script"
      ? {
          PARALLEL_LIMIT: z
            .string()
            .optional()
            .transform((v) => (v ? parseInt(v) : 5)),
        }
      : {}),
  },

  clientPrefix: "NEXT_PUBLIC_",
  client: {
    ...(process.env.APP === "website"
      ? {
          NEXT_PUBLIC_POSTHOG_KEY: z.string(),
        }
      : {}),
  },

  runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
