import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **website** app (`@easyshell/website`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),

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

    SMTP_HOST: z.string(),
    SMTP_USERNAME: z.string(),
    SMTP_PASSWORD: z.string(),
    SMTP_MAIL_FROM: z.string(),
  },

  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
  },

  runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
})
