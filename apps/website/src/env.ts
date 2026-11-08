import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/** Environment variables for the **website** app (`@easyshell/website`). */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),

    // better-auth also reads these two directly.
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),

    // Each OAuth provider is enabled only when both of its values are set.
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    COORDINATOR_URL: z.string().url(),
    WEBSITE_TOKEN: z.string(),

    ADMIN_EMAILS: z.string().min(1),

    // Email (magic link) sign-in through the Amazon SES API is enabled when
    // EMAIL_FROM is set. AWS credentials come from the standard AWS_* variables.
    EMAIL_FROM: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    SES_CONFIGURATION_SET: z.string().optional(),

    // PostHog is optional; without it the /ph proxy rewrites are omitted.
    POSTHOG_HOST: z.string().optional(),
  },

  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
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
